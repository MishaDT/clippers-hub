import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import QRCode from "qrcode";
import { isPrivateAddress } from "@/lib/ip-guard";

export const PAMPADU_URL = "https://ppdu.ru/2f0f0fbc-775f-471a-8cc3-783b3e50b904";
export const PAMPADU_SCRIPT_URL = "https://ppdu.ru/ppdw.js";

export function safeHttpsUrl(value: unknown) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// SVG can carry inline <script>; served from our own origin that is stored XSS. We never
// accept or emit SVG from the image proxy — only raster formats.
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 1_500_000;

export async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error("PRIVATE_URL");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("PRIVATE_URL");
    return; // literal, already-validated public IP — no DNS step
  }
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error("PRIVATE_URL");
}

async function readCapped(response: Response, max: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("NO_BODY");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        throw new Error("TOO_LARGE");
      }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function fetchPublicImage(input: string) {
  if (input.startsWith("data:")) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(input);
    if (!match) throw new Error("BAD_IMAGE_DATA");
    const body = Buffer.from(match[2], "base64");
    if (body.byteLength > MAX_IMAGE_BYTES) throw new Error("TOO_LARGE");
    return { body: new Uint8Array(body), contentType: match[1] };
  }

  let current = new URL(input);
  if (current.protocol !== "https:") throw new Error("BAD_PROTOCOL");
  for (let redirect = 0; redirect < 3; redirect += 1) {
    await assertPublicHost(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(current, {
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=.8",
          referer: `${current.origin}/`,
          "user-agent": "Mozilla/5.0 (compatible; ReelPay Image Proxy/1.0)"
        }
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("BAD_REDIRECT");
        current = new URL(location, current);
        if (current.protocol !== "https:") throw new Error("BAD_PROTOCOL");
        continue;
      }
      if (!response.ok) throw new Error(`IMAGE_${response.status}`);
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) throw new Error("BAD_CONTENT_TYPE");
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_IMAGE_BYTES) throw new Error("TOO_LARGE");
      // Stream with a hard cap instead of buffering the whole response: a server that lies
      // about (or omits) content-length cannot make us allocate unbounded memory.
      const body = await readCapped(response, MAX_IMAGE_BYTES);
      if (!body.byteLength) throw new Error("TOO_LARGE");
      return { body, contentType };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("TOO_MANY_REDIRECTS");
}

function meta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i")
  ];
  return patterns.map((pattern) => pattern.exec(html)?.[1]).find(Boolean) || "";
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export async function fetchStoreMetadata(input: string) {
  let current = new URL(input);
  for (let redirect = 0; redirect < 3; redirect += 1) {
    await assertPublicHost(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(current, {
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "ReelPay Store Metadata/1.0", accept: "text/html" }
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("BAD_REDIRECT");
        current = new URL(location, current);
        if (current.protocol !== "https:") throw new Error("BAD_PROTOCOL");
        continue;
      }
      if (!response.ok) throw new Error("FETCH_FAILED");
      const length = Number(response.headers.get("content-length") || 0);
      if (length > 1_000_000) throw new Error("TOO_LARGE");
      const html = (await response.text()).slice(0, 1_000_000);
      const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "";
      return {
        title: decode(meta(html, "og:title") || titleTag),
        description: decode(meta(html, "og:description") || meta(html, "description")),
        imageUrl: safeHttpsUrl(decode(meta(html, "og:image"))) || null,
        finalUrl: current.toString()
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("TOO_MANY_REDIRECTS");
}

export async function qrDataUrl(url: string) {
  return QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: "#080b07", light: "#ffffff" } });
}
