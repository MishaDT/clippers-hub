import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "@/lib/bearer-auth";
import { prisma } from "@/lib/prisma";
import { formatWeeklyDigest, postToChannel, telegramEnabled } from "@/lib/telegram";
import { realTransactionWhere } from "@/lib/data-scope";

export const maxDuration = 30;

// When CRON_SECRET is set, only callers presenting it may run the digest.
async function run() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Only explicitly real earnings count. Never infer data origin from an email address.
  const paidWhere = {
    ...realTransactionWhere,
    type: "EARNING" as const,
    status: "COMPLETED" as const,
    createdAt: { gte: since }
  };

  const [paidAgg, grouped, newCampaigns] = await Promise.all([
    prisma.transaction.aggregate({ where: paidWhere, _sum: { netCents: true } }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where: paidWhere,
      _sum: { netCents: true },
      orderBy: { _sum: { netCents: "desc" } },
      take: 1
    }),
    prisma.campaign.count({
      where: { createdAt: { gte: since }, isDemo: false, visibility: { in: ["PUBLIC", "FEATURED"] } }
    })
  ]);

  let topClipperHandle: string | null = null;
  let topClipperEarnedCents = 0;
  if (grouped.length) {
    const top = grouped[0];
    topClipperEarnedCents = top._sum.netCents || 0;
    const user = await prisma.user.findUnique({ where: { id: top.userId }, select: { handle: true } });
    topClipperHandle = user?.handle ?? null;
  }

  const totalPaidCents = paidAgg._sum.netCents || 0;
  const digest = {
    topPayoutCents: topClipperEarnedCents,
    topClipperHandle,
    topClipperEarnedCents,
    newCampaigns,
    totalPaidCents
  };

  let posted = false;
  if (telegramEnabled()) posted = await postToChannel(formatWeeklyDigest(digest));

  return { ...digest, posted, telegramEnabled: telegramEnabled() };
}

export async function GET(request: Request) {
  if (!hasValidBearerSecret(request, process.env.CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(request: Request) {
  if (!hasValidBearerSecret(request, process.env.CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
