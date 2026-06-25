import Link from "next/link";
import { Fingerprint, KeyRound, ShieldAlert } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { compactNumber } from "@/lib/money";
import { fullDate, providerLabel, statusLabel } from "@/lib/admin-format";
import { isConfigured } from "@/lib/oauth";
import { adminModerateSubmissionAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function AdminSecurityPage() {
  const day = daysAgo(1);
  const week = daysAgo(7);

  const [riskySubmissions, repeatedDevices, oauthLogins, recentSecurityEvents] = await Promise.all([
    prisma.submission.findMany({
      where: { OR: [{ fraudScore: { gte: 50 } }, { status: "REJECTED" }] },
      include: {
        worker: { select: { email: true, handle: true, trustScore: true } },
        campaign: { select: { id: true, title: true, viewThreshold: true } }
      },
      orderBy: [{ fraudScore: "desc" }, { updatedAt: "desc" }],
      take: 60
    }),
    prisma.analyticsEvent.groupBy({
      by: ["ipHash"],
      where: { ipHash: { not: null }, createdAt: { gte: day } },
      _count: { ipHash: true },
      orderBy: { _count: { ipHash: "desc" } },
      take: 12
    }),
    prisma.analyticsEvent.count({ where: { type: { in: ["OAUTH_LOGIN", "OAUTH_REGISTER"] }, createdAt: { gte: week } } }),
    prisma.analyticsEvent.findMany({
      where: { type: { in: ["LOGIN_SUCCESS", "LOGIN_FAILED", "OAUTH_LOGIN", "OAUTH_REGISTER", "OAUTH_FAILED", "SUBMISSION_FLAGGED"] }, createdAt: { gte: week } },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 30
    })
  ]);

  const repeatedHigh = repeatedDevices.filter((item) => item._count.ipHash >= 20);
  const checks = [
    { label: "Google OAuth", ok: isConfigured("google"), detail: "соц-вход" },
    { label: "VK ID OAuth", ok: isConfigured("vk"), detail: "RU-вход" },
    { label: "Yandex OAuth", ok: isConfigured("yandex"), detail: "доп. вход" },
    { label: "SESSION_SECRET", ok: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16), detail: "сессии" },
    { label: "CRON_SECRET", ok: Boolean(process.env.CRON_SECRET), detail: "защита sync" },
    { label: "ANALYTICS_SALT", ok: Boolean(process.env.ANALYTICS_SALT), detail: "хеш IP/UA" }
  ];

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Безопасность"
          title="Риски и модерация"
          description="Компактная очередь: подозрительные работы, повторяющиеся устройства, входы и состояние ключей."
        />

        <div className="admin-grid compact admin-kpi-strip">
          <Card className="admin-metric"><ShieldAlert /><span>Fraud 50+</span><strong>{riskySubmissions.length}</strong><small>работ</small></Card>
          <Card className="admin-metric"><Fingerprint /><span>Повторы 24ч</span><strong>{repeatedHigh.length}</strong><small>частые IP hash</small></Card>
          <Card className="admin-metric"><KeyRound /><span>OAuth 7д</span><strong>{oauthLogins}</strong><small>входы</small></Card>
        </div>

        <Card className="admin-panel">
          <div className="section-head compact"><h2>Чеклист</h2></div>
          <div className="admin-dense-list always">
            {checks.map((check) => (
              <details className="admin-dense-row" key={check.label}>
                <summary><span>{check.label}</span><b>{check.ok ? "OK" : "Нужно"}</b><em>{check.detail}</em></summary>
                <div className="admin-dense-details">
                  <p>{check.ok ? "Настроено." : "Нужно добавить env-переменную в Vercel и сделать redeploy."}</p>
                </div>
              </details>
            ))}
          </div>
        </Card>

        <Card className="admin-panel">
          <div className="section-head compact"><h2>Очередь fraud-review</h2><Link href="/admin/content">Контент</Link></div>
          <div className="admin-dense-list always">
            {riskySubmissions.map((submission) => (
              <details className="admin-dense-row" key={submission.id}>
                <summary><span>{submission.campaign.title}</span><b>{submission.fraudScore}%</b><em>@{submission.worker.handle}</em></summary>
                <div className="admin-dense-details">
                  <p><b>Исполнитель:</b> {submission.worker.email} · trust {submission.worker.trustScore}</p>
                  <p><b>Статус:</b> {statusLabel(submission.status)}</p>
                  <p><b>Просмотры:</b> {compactNumber(submission.currentViews)} / {compactNumber(submission.campaign.viewThreshold)}</p>
                  <p><b>Ссылка:</b> {submission.postUrl}</p>
                  <p><Link href={`/campaigns/${submission.campaign.id}`}>Открыть заказ</Link></p>
                  <form className="admin-row-form" action={adminModerateSubmissionAction}>
                    <input type="hidden" name="submissionId" value={submission.id} />
                    <select name="decision" defaultValue="approve"><option value="approve">Одобрить</option><option value="reject">Отклонить</option></select>
                    <button type="submit">OK</button>
                  </form>
                </div>
              </details>
            ))}
            {!riskySubmissions.length ? <p className="muted">Подозрительных работ сейчас нет.</p> : null}
          </div>
        </Card>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Повторы устройств</h2></div>
            <div className="admin-dense-list always">
              {repeatedDevices.map((item) => (
                <details className="admin-dense-row" key={item.ipHash || "unknown"}>
                  <summary><span>{item.ipHash ? `${item.ipHash.slice(0, 12)}...` : "unknown"}</span><b>{item._count.ipHash}</b><em>24ч</em></summary>
                  <div className="admin-dense-details"><p><b>IP hash:</b> {item.ipHash || "unknown"}</p></div>
                </details>
              ))}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>События риска</h2></div>
            <div className="admin-dense-list always">
              {recentSecurityEvents.map((event) => (
                <details className="admin-dense-row" key={event.id}>
                  <summary><span>{event.user?.email || "Гость"}</span><b>{event.type}</b><em>{fullDate(event.createdAt)}</em></summary>
                  <div className="admin-dense-details">
                    <p><b>Источник:</b> {providerLabel(event.provider)}</p>
                    <p><b>Страница:</b> {event.path || "нет"}</p>
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
