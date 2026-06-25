import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BriefcaseBusiness, Eye, Search, ShieldAlert, WalletCards } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";
import { clampPage, fullDate, pageHref, statusLabel } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

const pageSize = 35;
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

  const [total, campaigns, submissions, riskySubmissions] = await Promise.all([
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
    prisma.submission.aggregate({ _sum: { currentViews: true }, _count: true }),
    prisma.submission.count({ where: { fraudScore: { gte: 60 } } })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = { q, status: status === "ALL" ? "" : status };

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Контент"
          title="Заказы"
          description="Плотный список кампаний. Нажми строку, чтобы увидеть бюджет, заказчика и детали."
        />

        <div className="admin-grid compact admin-kpi-strip">
          <Card className="admin-metric"><BriefcaseBusiness /><span>Заказы</span><strong>{total}</strong><small>по фильтру</small></Card>
          <Card className="admin-metric"><Eye /><span>Просмотры</span><strong>{compactNumber(submissions._sum.currentViews || 0)}</strong><small>{submissions._count} работ</small></Card>
          <Card className="admin-metric"><ShieldAlert /><span>Риски</span><strong>{riskySubmissions}</strong><small>fraud 60+</small></Card>
        </div>

        <Card className="admin-panel admin-filter-panel">
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
                <div><strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong><span>{campaign.niche || "без ниши"} · {campaign.sourcePlatform}</span></div>
                <div><strong>{campaign.owner.name}</strong><span>{campaign.owner.email}</span></div>
                <div><Tag tone={campaign.status === "LOW_BUDGET" ? "warn" : campaign.status === "ACTIVE" ? "good" : "soft"}>{statusLabel(campaign.status)}</Tag></div>
                <div><strong>{rub(campaign.remainingBudgetCents)}</strong><span>из {rub(campaign.totalBudgetCents)}</span></div>
                <div><strong>{campaign._count.submissions}</strong><span>цель {compactNumber(campaign.viewThreshold)}</span></div>
              </div>
            ))}
          </div>

          <div className="admin-dense-list">
            {campaigns.map((campaign) => (
              <details className="admin-dense-row" key={campaign.id}>
                <summary>
                  <span>{campaign.title}</span>
                  <b>{statusLabel(campaign.status)}</b>
                  <em>{rub(campaign.remainingBudgetCents)}</em>
                </summary>
                <div className="admin-dense-details">
                  <p><b>Заказчик:</b> {campaign.owner.name} · {campaign.owner.email}</p>
                  <p><b>Ниша:</b> {campaign.niche || "без ниши"} · {campaign.sourcePlatform}</p>
                  <p><b>Бюджет:</b> {rub(campaign.remainingBudgetCents)} из {rub(campaign.totalBudgetCents)}</p>
                  <p><b>Работ:</b> {campaign._count.submissions} · цель {compactNumber(campaign.viewThreshold)}</p>
                  <p><b>Создан:</b> {fullDate(campaign.createdAt)}</p>
                  <p><Link href={`/campaigns/${campaign.id}`}>Открыть заказ</Link></p>
                </div>
              </details>
            ))}
          </div>
        </Card>

        <div className="admin-pagination">
          <Link className={page <= 1 ? "disabled" : ""} href={pageHref("/admin/content", baseParams, Math.max(1, page - 1))}>Назад</Link>
          <span>{page} / {totalPages}</span>
          <Link className={page >= totalPages ? "disabled" : ""} href={pageHref("/admin/content", baseParams, Math.min(totalPages, page + 1))}>Дальше</Link>
        </div>
      </div>
    </AdminShell>
  );
}
