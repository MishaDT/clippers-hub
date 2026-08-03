import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";
import { realSubmissionWhere, realTransactionWhere } from "@/lib/data-scope";
import styles from "./landing-stats.module.css";

const loadLandingStats = unstable_cache(
  async () => {
    const [activeCampaigns, paid, publications] = await Promise.all([
      prisma.campaign.count({
        where: {
          isDemo: false,
          status: { in: ["ACTIVE", "LOW_BUDGET"] },
          visibility: { in: ["PUBLIC", "FEATURED"] }
        }
      }),
      prisma.transaction.aggregate({
        where: { ...realTransactionWhere, type: "EARNING", status: "COMPLETED" },
        _sum: { netCents: true }
      }),
      prisma.submission.aggregate({
        where: {
          ...realSubmissionWhere,
          status: { in: ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"] }
        },
        _sum: { currentViews: true },
        _count: { id: true }
      })
    ]);

    return {
      activeCampaigns,
      paidCents: paid._sum.netCents || 0,
      verifiedViews: publications._sum.currentViews || 0,
      publications: publications._count.id
    };
  },
  ["landing-stats-v3"],
  { revalidate: 300 }
);

export async function LandingStats() {
  let stats: {
    activeCampaigns: number;
    paidCents: number;
    verifiedViews: number;
    publications: number;
  } | null = null;

  try {
    if (process.env.DATABASE_URL) stats = await loadLandingStats();
  } catch {
    stats = null;
  }

  const hasPublicResults = Boolean(
    stats && (stats.activeCampaigns > 0 || stats.paidCents > 0 || stats.verifiedViews > 0 || stats.publications > 0)
  );

  if (hasPublicResults && stats) {
    return (
      <section className={styles.section} aria-label="Реальные показатели ReelPay">
        <span className={styles.note}>Только реальные данные · обновление каждые 5 минут</span>
        <div className="lpa-metrics">
          <div><b>{rub(stats.paidCents)}</b><span>выплачено клипперам</span></div>
          <div><b>{compactNumber(stats.verifiedViews)}</b><span>подтверждённых просмотров</span></div>
          <div><b>{stats.activeCampaigns}</b><span>активных заказов без демо</span></div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-label="Как ReelPay защищает результат">
      <span className={styles.note}>Публичные цифры появятся только после реальных кампаний</span>
      <div className="lpa-metrics">
        <div><b>Эскроу</b><span>бюджет резервируется до результата</span></div>
        <div><b>API</b><span>просмотры проверяются автоматически, где это доступно</span></div>
        <div><b>Без демо</b><span>выдуманные заказы не попадают в публичную статистику</span></div>
      </div>
    </section>
  );
}
