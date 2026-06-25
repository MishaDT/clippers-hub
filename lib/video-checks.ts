import "server-only";

import type { PrismaClient } from "@prisma/client";
import { validatePublicMediaUrl } from "@/lib/content-safety";
import { parseJson, stringify } from "@/lib/json";

type PrismaTx = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type VideoCheckDecision = {
  status: "PASSED" | "NEEDS_REVIEW" | "FAILED";
  score: number;
  reasons: string[];
};

function readEvidence(resultJson: string) {
  return parseJson<{
    postUrl?: string;
    platform?: "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "VK" | "TWITCH";
    watermarkConfirmed?: boolean;
    workerVersion?: string;
  }>(resultJson, {});
}

export function decideWatermarkCheck(resultJson: string): VideoCheckDecision {
  const evidence = readEvidence(resultJson);
  const reasons: string[] = [];
  let score = 0;

  if (!evidence.postUrl || !evidence.platform) {
    return { status: "FAILED", score: 100, reasons: ["Нет ссылки или платформы для проверки"] };
  }

  const urlCheck = validatePublicMediaUrl(evidence.postUrl, evidence.platform);
  if (!urlCheck.ok) {
    score += 55;
    reasons.push(...urlCheck.reasons);
  }

  if (!evidence.watermarkConfirmed) {
    score += 35;
    reasons.push("Исполнитель не подтвердил watermark ReelPay");
  }

  if (!evidence.workerVersion) {
    reasons.push("Пиксельный ffmpeg-воркер пока не подключён, нужна ручная проверка превью");
    score += 15;
  }

  if (score >= 80) return { status: "FAILED", score: Math.min(score, 100), reasons };
  if (score >= 20) return { status: "NEEDS_REVIEW", score: Math.min(score, 100), reasons };
  return { status: "PASSED", score, reasons: ["Ссылка безопасна, watermark подтверждён исполнителем"] };
}

export async function notifyModerators(
  prisma: PrismaTx,
  payload: { title: string; body: string; entityId: string; metadata?: Record<string, unknown> }
) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true }
  });
  if (!admins.length) return;

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title: payload.title,
      body: payload.body,
      channel: "in-app",
      priority: "HIGH"
    }))
  });
  await prisma.auditLog.create({
    data: {
      action: "MODERATION_NOTIFY",
      entity: "VideoCheck",
      entityId: payload.entityId,
      metadata: stringify(payload.metadata || {})
    }
  });
}

export async function runWatermarkQueue(prisma: PrismaClient, limit = 20) {
  const jobs = await prisma.videoCheck.findMany({
    where: { status: "PENDING" },
    include: { submission: true },
    orderBy: { createdAt: "asc" },
    take: limit
  });

  const results = [];
  for (const job of jobs) {
    await prisma.videoCheck.update({ where: { id: job.id }, data: { status: "RUNNING" } });
    const decision = decideWatermarkCheck(job.resultJson);
    const resultJson = stringify({
      ...readEvidence(job.resultJson),
      checkedAt: new Date().toISOString(),
      reasons: decision.reasons
    });

    const [updated] = await prisma.$transaction([
      prisma.videoCheck.update({
        where: { id: job.id },
        data: { status: decision.status, score: decision.score, resultJson }
      }),
      prisma.submission.update({
        where: { id: job.submissionId },
        data: {
          fraudScore: Math.max(job.submission.fraudScore, decision.score),
          status: decision.status === "FAILED" ? "REJECTED" : job.submission.status
        }
      })
    ]);
    results.push(updated);
  }

  return results;
}
