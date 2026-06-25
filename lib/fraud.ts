import "server-only";

import type { Platform, Submission, User } from "@prisma/client";
import { validatePublicMediaUrl } from "@/lib/content-safety";

export function scoreSubmissionFraud({
  postUrl,
  platform,
  user,
  duplicateUrl,
  recentSubmissions,
  watermarkRequired = false,
  watermarkConfirmed = false
}: {
  postUrl: string;
  platform: Platform;
  user: Pick<User, "trustScore">;
  duplicateUrl: boolean;
  recentSubmissions: Pick<Submission, "createdAt" | "postUrl">[];
  watermarkRequired?: boolean;
  watermarkConfirmed?: boolean;
}) {
  let score = 5;
  const reasons: string[] = [];
  const trimmed = postUrl.trim();
  const urlCheck = validatePublicMediaUrl(trimmed, platform);

  if (!urlCheck.ok) {
    score += 35;
    reasons.push(...urlCheck.reasons);
  }

  if (duplicateUrl) {
    score += 42;
    reasons.push("Такая ссылка уже сдавалась");
  }

  const lastHour = Date.now() - 60 * 60 * 1000;
  const recentCount = recentSubmissions.filter((item) => item.createdAt.getTime() >= lastHour).length;
  if (recentCount >= 5) {
    score += 22;
    reasons.push("Слишком много работ за последний час");
  }

  if (user.trustScore < 50) {
    score += 18;
    reasons.push("Низкий trust score исполнителя");
  }

  if (watermarkRequired && !watermarkConfirmed) {
    score += 24;
    reasons.push("Watermark ReelPay не подтвержден исполнителем");
  }

  return {
    score: Math.min(95, score),
    reasons: reasons.length ? reasons : ["Базовая проверка пройдена"]
  };
}
