import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import QRCode from "qrcode";

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

function privateAddress(address: string) {
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
  if (address.startsWith("10.") || address.startsWith("127.") || address.startsWith("192.168.") || address.startsWith("169.254.")) return true;
  const match = /^172\.(\d+)\./.exec(address);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:");
}

export async function assertPublicHost(url: URL) {
  if (url.hostname === "localhost" || isIP(url.hostname) && privateAddress(url.hostname)) throw new Error("PRIVATE_URL");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => privateAddress(item.address))) throw new Error("PRIVATE_URL");
}

export async function fetchPublicImage(input: string) {
  if (input.startsWith("data:")) {
    const match = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([a-z0-9+/=\s]+)$/i.exec(input);
    if (!match) throw new Error("BAD_IMAGE_DATA");
    const body = Buffer.from(match[2], "base64");
    if (body.byteLength > 1_500_000) throw new Error("TOO_LARGE");
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
          accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=.8",
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
      const contentType = response.headers.get("content-type")?.split(";")[0] || "";
      if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/avif"].includes(contentType)) throw new Error("BAD_CONTENT_TYPE");
      const length = Number(response.headers.get("content-length") || 0);
      if (length > 1_500_000) throw new Error("TOO_LARGE");
      const body = new Uint8Array(await response.arrayBuffer());
      if (!body.byteLength || body.byteLength > 1_500_000) throw new Error("TOO_LARGE");
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
