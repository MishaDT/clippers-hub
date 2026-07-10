import "server-only";

import { prisma } from "@/lib/prisma";
import type { AchievementStats } from "@/lib/achievements";

const APPROVED = ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"] as const;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Single source of truth for achievement progress — used by the profile page
// (display) and the claim action (server-side validation).
export async function loadAchievementStats(user: {
  id: string;
  isDemo: boolean;
  streakDays: number;
  referralCode: string;
}): Promise<AchievementStats> {
  const since = new Date(Date.now() - WEEK_MS);
  const workScope = user.isDemo ? {} : { campaign: { isDemo: false } };
  const campaignScope = user.isDemo ? {} : { isDemo: false };
  const [approvedClips, totalClips, weekViews, best, referrals, campaigns, clipsReceived, completedOrders] = await Promise.all([
    prisma.submission.count({ where: { workerId: user.id, ...workScope, status: { in: [...APPROVED] } } }),
    prisma.submission.count({ where: { workerId: user.id, ...workScope } }),
    prisma.submission.aggregate({ where: { workerId: user.id, ...workScope, createdAt: { gte: since } }, _sum: { currentViews: true } }),
    prisma.submission.aggregate({ where: { workerId: user.id, ...workScope }, _max: { currentViews: true } }),
    prisma.referralRelation.count({ where: { referrerId: user.id, status: "ACTIVE" } }),
    prisma.campaign.count({ where: { ownerId: user.id, ...campaignScope } }),
    prisma.submission.count({ where: { campaign: { ownerId: user.id, ...campaignScope } } }),
    prisma.submission.count({ where: { workerId: user.id, ...workScope, status: "PAID", updatedAt: { gte: since } } })
  ]);

  return {
    approvedClips,
    totalClips,
    weekViews: weekViews._sum.currentViews || 0,
    bestClipViews: best._max.currentViews || 0,
    streakDays: user.streakDays || 0,
    referrals,
    campaigns,
    clipsReceived,
    completedOrders
  };
}
