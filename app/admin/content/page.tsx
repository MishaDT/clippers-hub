import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BriefcaseBusiness, Eye, Search, ShieldAlert, WalletCards } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";
import { clampPage, fullDate, pageHref, statusLabel } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

const pageSize = 12;
const statuses = ["ALL", "ACTIVE", "LOW_BUDGET", "PAUSED", "COMPLETED", "DRAFT"] as const;

export default async function AdminContentPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = String(params.q || "").trim();
  const status = statuses.includes(String(params.status) as (typeof statuses)[number]) ? String(params.status) : "ALL";
  const page = clampPage(params.page);

  const where: Prisma.CampaignWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { owner: { email: { contains: q, mode: "insensitive" } } },
      { owner: { name: { contains: q, mode: "insensitive" } } }
    ];
  }
  if (status !== "ALL") where.status = status as Prisma.EnumCampaignStatusFilter["equals"];

  const [
    total,
    campaigns,
    totalBudget,
    remainingBudget,
    submissions,
    riskySubmissions,
    recentSubmissions
  ] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({
      where,
      include: {
        owner: { select: { name: true, email: true, handle: true } },
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.campaign.aggregate({ _sum: { totalBudgetCents: true } }),
    prisma.campaign.aggregate({ _sum: { remainingBudgetCents: true } }),
    prisma.submission.aggregate({ _sum: { currentViews: true, currentLikes: true }, _count: true }),
    prisma.submission.count({ where: { fraudScore: { gte: 60 } } }),
    prisma.submission.findMany({
      where: { OR: [{ fraudScore: { gte: 60 } }, { status: { in: ["THRESHOLD_MET", "SETTLING"] } }] },
      include: {
        campaign: { select: { title: true, viewThreshold: true } },
        worker: { select: { name: true, email: true, handle: true } }
      },
      orderBy: [{ fraudScore: "desc" }, { updatedAt: "desc" }],
      take: 10
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = { q, status: status === "ALL" ? "" : status };

  return (
    <AdminShell>
      <div className="admin-screen">
        <AdminPageHeader
          eyebrow="Контент"
          title="Заказы, работы и бюджеты"
          description="Контроль кампаний, сабмишенов, просмотров, остатка бюджета и работ, которые требуют внимания."
        />

        <div className="admin-grid compact">
          <Card className="admin-metric"><BriefcaseBusiness /><span>Заказы</span><strong>{total}</strong><small>по текущему фильтру</small></Card>
          <Card className="admin-metric"><Eye /><span>Просмотры работ</span><strong>{compactNumber(submissions._sum.currentViews || 0)}</strong><small>{submissions._count} сабмишенов</small></Card>
          <Card className="admin-metric"><WalletCards /><span>Бюджет всего</span><strong>{rub(totalBudget._sum.totalBudgetCents || 0)}</strong><small>{rub(remainingBudget._sum.remainingBudgetCents || 0)} осталось</small></Card>
          <Card className="admin-metric"><ShieldAlert /><span>Риски</span><strong>{riskySubmissions}</strong><small>fraud score 60+</small></Card>
        </div>

        <Card className="admin-panel">
          <form className="admin-filter-bar" action="/admin/content">
            <label>
              <Search size={18} />
              <input name="q" defaultValue={q} placeholder="Название, заказчик, email" />
            </label>
            <select name="status" defaultValue={status}>
              <option value="ALL">Все статусы</option>
              <option value="ACTIVE">Активные</option>
              <option value="LOW_BUDGET">Мало бюджета</option>
              <option value="PAUSED">Пауза</option>
              <option value="COMPLETED">Завершены</option>
              <option value="DRAFT">Черновики</option>
            </select>
            <button className="btn btn-primary" type="submit">Найти</button>
          </form>
        </Card>

        <Card className="admin-panel">
          <div className="section-head compact">
            <h2>Кампании</h2>
          </div>
          <div className="admin-table content-table">
            <div className="admin-table-head">
              <span>Заказ</span>
              <span>Заказчик</span>
              <span>Статус</span>
              <span>Бюджет</span>
              <span>Работы</span>
            </div>
            {campaigns.map((campaign) => (
              <div className="admin-table-row" key={campaign.id}>
                <div>
                  <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                  <span>{campaign.niche || "без ниши"} · {campaign.sourcePlatform}</span>
                  <small>создан {fullDate(campaign.createdAt)}</small>
                </div>
                <div>
                  <strong>{campaign.owner.name}</strong>
                  <span>{campaign.owner.email}</span>
                </div>
                <div><Tag tone={campaign.status === "LOW_BUDGET" ? "warn" : campaign.status === "ACTIVE" ? "good" : "soft"}>{statusLabel(campaign.status)}</Tag></div>
                <div>
                  <strong>{rub(campaign.remainingBudgetCents)}</strong>
                  <span>из {rub(campaign.totalBudgetCents)}</span>
                </div>
                <div>
                  <strong>{campaign._count.submissions}</strong>
                  <span>цель {compactNumber(campaign.viewThreshold)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="admin-pagination">
          <Link className={page <= 1 ? "disabled" : ""} href={pageHref("/admin/content", baseParams, Math.max(1, page - 1))}>Назад</Link>
          <span>{page} / {totalPages}</span>
          <Link className={page >= totalPages ? "disabled" : ""} href={pageHref("/admin/content", baseParams, Math.min(totalPages, page + 1))}>Дальше</Link>
        </div>

        <Card className="admin-panel">
          <div className="section-head compact">
            <h2>Работы, требующие внимания</h2>
            <Link href="/admin/security">Безопасность</Link>
          </div>
          <div className="admin-list">
            {recentSubmissions.map((submission) => (
              <div className="admin-event" key={submission.id}>
                <ShieldAlert size={16} />
                <div>
                  <strong>{submission.campaign.title}</strong>
                  <span>@{submission.worker.handle} · {compactNumber(submission.currentViews)} / {compactNumber(submission.campaign.viewThreshold)} просмотров</span>
                </div>
                <Tag tone={submission.fraudScore >= 60 ? "warn" : "soft"}>{submission.fraudScore}%</Tag>
              </div>
            ))}
            {!recentSubmissions.length ? <p className="muted">Сейчас нет работ с высоким риском или выплатой на проверке.</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
