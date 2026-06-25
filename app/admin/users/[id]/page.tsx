import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, Shield, UserCog } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";
import { eventLabel, fullDate, providerLabel, roleLabel, statusLabel } from "@/lib/admin-format";
import { adminAdjustBalanceAction, adminDeleteUserAction, adminUpdateUserAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      oauthAccounts: true,
      ownedCampaigns: { orderBy: { createdAt: "desc" }, take: 12, include: { _count: { select: { submissions: true } } } },
      submissions: { orderBy: { updatedAt: "desc" }, take: 12, include: { campaign: { select: { id: true, title: true, viewThreshold: true } } } },
      transactions: { orderBy: { createdAt: "desc" }, take: 18 },
      analyticsEvents: { orderBy: { createdAt: "desc" }, take: 18 },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });
  if (!user) notFound();

  const auth = user.oauthAccounts.length ? user.oauthAccounts.map((item) => providerLabel(item.provider)).join(", ") : "Email";

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Пользователь"
          title={user.name}
          description={`${user.email} · @${user.handle} · ${auth}`}
          action={<Link className="btn" href="/admin/users"><ArrowLeft size={16} /> Назад</Link>}
        />

        <div className="admin-grid compact admin-kpi-strip">
          <Card className="admin-metric"><UserCog /><span>Роль</span><strong>{roleLabel(user.role)}</strong><small>trust {user.trustScore}</small></Card>
          <Card className="admin-metric"><Banknote /><span>Баланс</span><strong>{rub(user.balanceCents)}</strong><small>hold {rub(user.holdBalanceCents)}</small></Card>
          <Card className="admin-metric"><Shield /><span>Контент</span><strong>{compactNumber(user.lifetimeViews)}</strong><small>{user.submissions.length} последних работ</small></Card>
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Управление</h2></div>
            <form className="admin-edit-form" action={adminUpdateUserAction}>
              <input type="hidden" name="userId" value={user.id} />
              <label>Роль<select name="role" defaultValue={user.role}><option value="ADMIN">Админ</option><option value="CLIENT">Заказчик</option><option value="WORKER">Клиппер</option><option value="BOTH">Обе роли</option></select></label>
              <label>Ранг<select name="rank" defaultValue={user.rank}><option value="BRONZE">Bronze</option><option value="SILVER">Silver</option><option value="GOLD">Gold</option><option value="DIAMOND">Diamond</option><option value="LEGENDARY">Legendary</option></select></label>
              <label>KYC<select name="kycStatus" defaultValue={user.kycStatus}><option value="NONE">None</option><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option></select></label>
              <label>Trust score<input name="trustScore" type="number" min="0" max="100" defaultValue={user.trustScore} /></label>
              <button className="btn btn-primary" type="submit">Сохранить</button>
            </form>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>Баланс</h2></div>
            <form className="admin-edit-form" action={adminAdjustBalanceAction}>
              <input type="hidden" name="userId" value={user.id} />
              <label>Операция<select name="direction" defaultValue="plus"><option value="plus">Начислить</option><option value="minus">Списать</option></select></label>
              <label>Сумма, ₽<input name="amount" type="number" min="1" defaultValue="1000" /></label>
              <label>Причина<input name="reason" defaultValue="Ручная корректировка" /></label>
              <button className="btn btn-primary" type="submit">Применить</button>
            </form>
          </Card>
        </div>

        <Card className="admin-panel danger-panel">
          <div className="section-head compact"><h2>Опасная зона</h2></div>
          <form className="admin-inline-form" action={adminDeleteUserAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input name="confirmation" placeholder="Напиши DELETE" />
            <button className="btn" type="submit">Удалить пользователя</button>
          </form>
        </Card>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Заказы</h2></div>
            <div className="admin-dense-list always">
              {user.ownedCampaigns.map((campaign) => (
                <details className="admin-dense-row" key={campaign.id}>
                  <summary><span>{campaign.title}</span><b>{statusLabel(campaign.status)}</b><em>{rub(campaign.remainingBudgetCents)}</em></summary>
                  <div className="admin-dense-details">
                    <p><b>Работ:</b> {campaign._count.submissions}</p>
                    <p><b>Бюджет:</b> {rub(campaign.remainingBudgetCents)} из {rub(campaign.totalBudgetCents)}</p>
                    <p><Link href={`/campaigns/${campaign.id}`}>Открыть заказ</Link></p>
                  </div>
                </details>
              ))}
              {!user.ownedCampaigns.length ? <p className="muted">Заказов нет.</p> : null}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>Работы</h2></div>
            <div className="admin-dense-list always">
              {user.submissions.map((submission) => (
                <details className="admin-dense-row" key={submission.id}>
                  <summary><span>{submission.campaign.title}</span><b>{statusLabel(submission.status)}</b><em>{compactNumber(submission.currentViews)}</em></summary>
                  <div className="admin-dense-details">
                    <p><b>Fraud:</b> {submission.fraudScore}%</p>
                    <p><b>Платформа:</b> {submission.platform}</p>
                    <p><b>Ссылка:</b> {submission.postUrl}</p>
                    <p><Link href={`/campaigns/${submission.campaign.id}`}>Открыть заказ</Link></p>
                  </div>
                </details>
              ))}
              {!user.submissions.length ? <p className="muted">Работ нет.</p> : null}
            </div>
          </Card>
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Транзакции</h2><Link href={`/admin/finance?q=${encodeURIComponent(user.email)}`}>Все</Link></div>
            <div className="admin-dense-list always">
              {user.transactions.map((tx) => (
                <details className="admin-dense-row" key={tx.id}>
                  <summary><span>{tx.type}</span><b>{statusLabel(tx.status)}</b><em>{rub(tx.netCents)}</em></summary>
                  <div className="admin-dense-details">
                    <p><b>Дата:</b> {fullDate(tx.createdAt)}</p>
                    <p><b>Провайдер:</b> {tx.provider || "нет"}</p>
                    <p><b>Комиссия:</b> {rub(tx.feeCents)}</p>
                  </div>
                </details>
              ))}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>История</h2></div>
            <div className="admin-dense-list always">
              {user.analyticsEvents.map((event) => (
                <details className="admin-dense-row" key={event.id}>
                  <summary><span>{eventLabel(event.type)}</span><b>{providerLabel(event.provider)}</b><em>{fullDate(event.createdAt)}</em></summary>
                  <div className="admin-dense-details">
                    <p><b>Страница:</b> {event.path || "нет"}</p>
                    <p><b>IP hash:</b> {event.ipHash || "нет"}</p>
                  </div>
                </details>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
