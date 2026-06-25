import "server-only";

import { detectPlatformFromUrl, validatePublicMediaUrl } from "@/lib/content-safety";

const urlPattern = /https?:\/\/[^\s<>"']+/gi;

function appHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.OAUTH_REDIRECT_BASE || "https://clippers-hub.vercel.app").hostname.replace(/^www\./, "");
  } catch {
    return "clippers-hub.vercel.app";
  }
}

export function extractUrls(text: string) {
  return Array.from(new Set(text.match(urlPattern) || [])).slice(0, 5);
}

export function validateChatMessage(raw: string) {
  const body = raw.replace(/\s+/g, " ").trim().slice(0, 1200);
  const reasons: string[] = [];
  if (body.length < 1) reasons.push("Сообщение пустое");
  if (body.length > 1000) reasons.push("Сообщение слишком длинное");

  const urls = extractUrls(body);
  for (const value of urls) {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "");
      const isInternal = host === appHost() || host.endsWith(`.${appHost()}`);
      const isMedia = validatePublicMediaUrl(value).ok;
      if (!isInternal && !isMedia) reasons.push(`Запрещенная ссылка: ${host}`);
    } catch {
      reasons.push("В сообщении есть некорректная ссылка");
    }
  }

  return {
    ok: reasons.length === 0,
    body,
    urls,
    reasons
  };
}

export function buildSafePreview(urlValue: string) {
  try {
    const url = new URL(urlValue);
    const platform = detectPlatformFromUrl(urlValue);
    return {
      url: url.toString(),
      host: url.hostname.replace(/^www\./, ""),
      platform: platform || "LINK",
      title: platform ? `${platform} preview` : "Ссылка ReelPay"
    };
  } catch {
    return null;
  }
}
