import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notificationGroup, notify } from "@/lib/notifications";
import { boundedInteger } from "@/lib/numbers";

// A prune pass can touch many rows; give it room but stay within serverless limits.
export const maxDuration = 60;

// When CRON_SECRET is set, only callers presenting it may run the cleanup.
// Vercel Cron automatically sends `Authorization: Bearer ${CRON_SECRET}`.
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Retention: keep high-volume PAGE_VIEW analytics for a bounded window, then prune. Other
// event types (auth, submissions, store clicks) are retained for audit / abuse history.
async function run() {
  const retentionDays = boundedInteger(process.env.ANALYTICS_RETENTION_DAYS, { min: 7, max: 3_650, fallback: 90 });
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let deleted = 0;
  const expiredSessions = await prisma.authSession.deleteMany({
    // Keep revoked rows until the original token expires. Legacy-session tombstones
    // must remain present for their full 30-day lifetime or an old copied cookie could
    // enrol itself again after an early cleanup pass.
    where: { expiresAt: { lt: new Date() } }
  });
  const expiredEmailTokens = await prisma.emailVerificationToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      ]
    }
  });
  // Batch-delete with a hard cap on iterations so one run can't exceed maxDuration.
  for (let i = 0; i < 20; i += 1) {
    const batch = await prisma.analyticsEvent.findMany({
      where: { type: "PAGE_VIEW", createdAt: { lt: cutoff } },
      select: { id: true },
      take: 5000
    });
    if (!batch.length) break;
    const res = await prisma.analyticsEvent.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } });
    deleted += res.count;
    if (res.count === 0) break;
  }
  const now = new Date();
  const reminderCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const due = await prisma.submission.findMany({
    where: {
      status: { in: ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET"] },
      campaign: { deadline: { gt: now, lte: reminderCutoff }, status: { in: ["ACTIVE", "LOW_BUDGET", "PAUSED"] } }
    },
    select: {
      id: true,
      workerId: true,
      campaignId: true,
      campaign: { select: { title: true, ownerId: true, deadline: true } }
    },
    take: 200
  });
  let reminders = 0;
  for (const item of due) {
    for (const userId of new Set([item.workerId, item.campaign.ownerId])) {
      const groupKey = notificationGroup("deadline-24h", `${item.id}:${userId}`);
      const existing = await prisma.notification.findUnique({
        where: { userId_groupKey: { userId, groupKey } },
        select: { id: true }
      });
      if (existing) continue;
      const hours = Math.max(1, Math.ceil((item.campaign.deadline.getTime() - now.getTime()) / 3_600_000));
      await notify({
        userId,
        groupKey,
        title: "До дедлайна меньше суток",
        body: `По заказу «${item.campaign.title}» осталось около ${hours} ч. Проверьте следующий шаг сделки.`,
        priority: "HIGH",
        kind: "DEADLINE",
        href: `/campaigns/${item.campaignId}`
      });
      reminders += 1;
    }
  }
  return {
    deleted,
    expiredSessions: expiredSessions.count,
    expiredEmailTokens: expiredEmailTokens.count,
    reminders,
    retentionDays,
    cutoff: cutoff.toISOString()
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
