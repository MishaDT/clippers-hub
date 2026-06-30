import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  const retentionDays = Math.max(7, Number(process.env.ANALYTICS_RETENTION_DAYS || 90));
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let deleted = 0;
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
  return { deleted, retentionDays, cutoff: cutoff.toISOString() };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
