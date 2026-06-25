import "server-only";

import type { Platform } from "@prisma/client";

const platformHosts: Record<Platform, string[]> = {
  YOUTUBE: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
  TIKTOK: ["tiktok.com"],
  INSTAGRAM: ["instagram.com"],
  VK: ["vk.com", "vkvideo.ru"],
  TWITCH: ["twitch.tv"]
};

const blockedHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "example.com", "test.com", "invalid"]);
const suspiciousExtensions = [".exe", ".msi", ".bat", ".cmd", ".scr", ".js", ".jar", ".zip", ".rar", ".7z", ".dmg"];

function hostWithoutWww(url: URL) {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

function isPrivateHost(host: string) {
  if (blockedHosts.has(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  return false;
}

export function allowedHostsForPlatform(platform: Platform) {
  return platformHosts[platform] || [];
}

export function platformMatchesUrl(platform: Platform, url: URL) {
  const host = hostWithoutWww(url);
  return allowedHostsForPlatform(platform).some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function detectPlatformFromUrl(value: string): Platform | null {
  try {
    const url = new URL(value);
    const host = hostWithoutWww(url);
    for (const [platform, hosts] of Object.entries(platformHosts) as Array<[Platform, string[]]>) {
      if (hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return platform;
    }
  } catch {}
  return null;
}

export function validatePublicMediaUrl(value: string, platform?: Platform) {
  const reasons: string[] = [];
  const trimmed = value.trim();
  let url: URL | null = null;

  try {
    url = new URL(trimmed);
  } catch {
    reasons.push("Ссылка не похожа на URL");
  }

  if (url) {
    const host = hostWithoutWww(url);
    if (url.protocol !== "https:") reasons.push("Нужна HTTPS-ссылка");
    if (url.username || url.password) reasons.push("Ссылка не должна содержать логин/пароль");
    if (isPrivateHost(host)) reasons.push("Локальные и тестовые адреса запрещены");
    if (suspiciousExtensions.some((ext) => url!.pathname.toLowerCase().endsWith(ext))) reasons.push("Ссылка похожа на файл, а нужна страница видео");
    if (platform && !platformMatchesUrl(platform, url)) reasons.push(`Ссылка не совпадает с платформой ${platform}`);
    if (!platform && !detectPlatformFromUrl(trimmed)) reasons.push("Поддерживаются только YouTube, TikTok, Instagram, VK и Twitch");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    normalizedUrl: url ? url.toString().slice(0, 500) : trimmed.slice(0, 500),
    platform: url ? detectPlatformFromUrl(trimmed) : null
  };
}

export function extractPlatformPostId(postUrl: string) {
  try {
    const url = new URL(postUrl);
    if (url.hostname.includes("youtu.be")) return url.pathname.split("/").filter(Boolean)[0]?.slice(0, 80) || `post_${Date.now()}`;
    if (url.searchParams.get("v")) return url.searchParams.get("v")!.slice(0, 80);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1)?.slice(0, 80) || `post_${Date.now()}`;
  } catch {
    return `post_${Date.now()}`;
  }
}
