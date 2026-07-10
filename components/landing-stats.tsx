import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rub } from "@/lib/money";
import { realTransactionWhere, realUserWhere } from "@/lib/data-scope";

// Live social proof for the landing. Rule: while the platform is small we keep showing the
// honestly-labeled «Демо» examples; once there is real traction (thresholds below), the block
// switches to real numbers automatically. Never invent figures.
const THRESHOLD_CAMPAIGNS = 10;
const THRESHOLD_PAID_CENTS = 50_000 * 100;

const loadLandingStats = unstable_cache(
  async () => {
    const [activeCampaigns, paid, clippers] = await Promise.all([
      prisma.campaign.count({
        where: { isDemo: false, status: { in: ["ACTIVE", "LOW_BUDGET"] }, visibility: { in: ["PUBLIC", "FEATURED"] } }
      }),
      prisma.transaction.aggregate({
        where: { ...realTransactionWhere, type: "EARNING", status: "COMPLETED" },
        _sum: { netCents: true }
      }),
      prisma.user.count({
        where: {
          ...realUserWhere,
          role: { in: ["WORKER", "BOTH"] },
          submissions: {
            some: {
              campaign: { isDemo: false },
              status: { in: ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"] }
            }
          }
        }
      })
    ]);
    return { activeCampaigns, paidCents: paid._sum.netCents || 0, clippers };
  },
  ["landing-stats-v2"],
  { revalidate: 300 }
);

export async function LandingStats() {
  let stats: { activeCampaigns: number; paidCents: number; clippers: number } | null = null;
  try {
    if (process.env.DATABASE_URL) stats = await loadLandingStats();
  } catch {
    stats = null;
  }

  const real = stats && stats.activeCampaigns >= THRESHOLD_CAMPAIGNS && stats.paidCents >= THRESHOLD_PAID_CENTS;

  if (real && stats) {
    return (
      <div className="lpa-metrics">
        <div><b>{rub(stats.paidCents)}</b><span>выплачено клипперам</span></div>
        <div><b>{stats.clippers.toLocaleString("ru-RU")}</b><span>клипперов с подтверждёнными просмотрами</span></div>
        <div><b>{stats.activeCampaigns}</b><span>активных заданий в ленте</span></div>
      </div>
    );
  }

  return (
    <div className="lpa-metrics">
      <div><b>₽4,2 млн <small>Демо</small></b><span>пример оборота платформы</span></div>
      <div><b>1 800+ <small>Демо</small></b><span>пример активного сообщества</span></div>
      <div><b>320 <small>Демо</small></b><span>пример наполненной ленты</span></div>
    </div>
  );
}
