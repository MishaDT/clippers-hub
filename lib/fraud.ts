import "server-only";

import type { Platform, Submission, User } from "@prisma/client";

const platformHosts: Record<Platform, string[]> = {
  TIKTOK: ["tiktok.com"],
  YOUTUBE: ["youtube.com", "youtu.be"],
  INSTAGRAM: ["instagram.com"],
  VK: ["vk.com", "vkvideo.ru"],
  TWITCH: ["twitch.tv"]
};

function hostname(postUrl: string) {
  try {
    return new URL(postUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function platformMatchesUrl(platform: Platform, postUrl: string) {
  const host = hostname(postUrl);
  return Boolean(host && platformHosts[platform]?.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)));
}

export function extractPlatformPostId(postUrl: string) {
  try {
    const url = new URL(postUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1)?.slice(0, 80) || `post_${Date.now()}`;
  } catch {
    return `post_${Date.now()}`;
  }
}

export function scoreSubmissionFraud({
  postUrl,
  platform,
  user,
  duplicateUrl,
  recentSubmissions
}: {
  postUrl: string;
  platform: Platform;
  user: Pick<User, "trustScore">;
  duplicateUrl: boolean;
  recentSubmissions: Pick<Submission, "createdAt" | "postUrl">[];
}) {
  let score = 5;
  const reasons: string[] = [];
  const trimmed = postUrl.trim();

  if (!/^https:\/\/.+\..+/.test(trimmed)) {
    score += 35;
    reasons.push("ссылка не https или выглядит неполной");
  }

  if (!platformMatchesUrl(platform, trimmed)) {
    score += 28;
    reasons.push("платформа не совпадает с доменом ссылки");
  }

  if (duplicateUrl) {
    score += 42;
    reasons.push("такая ссылка уже сдавалась");
  }

  if (trimmed.includes("example.com") || trimmed.includes("localhost")) {
    score += 45;
    reasons.push("тестовая или локальная ссылка");
  }

  const lastHour = Date.now() - 60 * 60 * 1000;
  const recentCount = recentSubmissions.filter((item) => item.createdAt.getTime() >= lastHour).length;
  if (recentCount >= 5) {
    score += 22;
    reasons.push("слишком много работ за последний час");
  }

  if (user.trustScore < 50) {
    score += 18;
    reasons.push("низкий trust score исполнителя");
  }

  return {
    score: Math.min(95, score),
    reasons: reasons.length ? reasons : ["базовая проверка пройдена"]
  };
}
