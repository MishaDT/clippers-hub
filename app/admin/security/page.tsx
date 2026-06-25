import Link from "next/link";
import { AlertTriangle, CheckCircle2, Fingerprint, KeyRound, ShieldAlert } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { compactNumber } from "@/lib/money";
import { fullDate, providerLabel, statusLabel } from "@/lib/admin-format";
import { isConfigured } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function AdminSecurityPage() {
  const day = daysAgo(1);
  const week = daysAgo(7);

  const [riskySubmissions, repeatedDevices, oauthLogins, recentSecurityEvents] = await Promise.all([
    prisma.submission.findMany({
      where: { fraudScore: { gte: 50 } },
      include: {
        worker: { select: { email: true, handle: true, trustScore: true } },
        campaign: { select: { id: true, title: true, viewThreshold: true } }
      },
      orderBy: [{ fraudScore: "desc" }, { updatedAt: "desc" }],
      take: 30
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
      where: { type: { in: ["LOGIN_SUCCESS", "OAUTH_LOGIN", "OAUTH_REGISTER", "OAUTH_LINK"] }, createdAt: { gte: week } },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  const repeatedHigh = repeatedDevices.filter((item) => item._count.ipHash >= 20);
  const checks = [
    { label: "Google OAuth", ok: isConfigured("google"), detail: "основной соц-вход" },
    { label: "VK ID OAuth", ok: isConfigured("vk"), detail: "для RU-аудитории" },
    { label: "Yandex OAuth", ok: isConfigured("yandex"), detail: "дополнительный вход" },
    { label: "SESSION_SECRET", ok: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16), detail: "подпись сессий" },
    { label: "ANALYTICS_SALT", ok: Boolean(process.env.ANALYTICS_SALT), detail: "хеширование IP/UA" },
    { label: "ADMIN_EMAILS", ok: Boolean(process.env.ADMIN_EMAILS), detail: "доступ владельца" }
  ];

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Безопасность"
          title="Риски"
          description="Только то, что нужно проверять: fraud, повторы устройств, входы и статус ключей."
        />

        <div className="admin-grid compact admin-kpi-strip">
          <Card className="admin-metric"><ShieldAlert /><span>Fraud 50+</span><strong>{riskySubmissions.length}</strong><small>работ</small></Card>
          <Card className="admin-metric"><Fingerprint /><span>Повторы 24ч</span><strong>{repeatedHigh.length}</strong><small>частые устройства</small></Card>
          <Card className="admin-metric"><KeyRound /><span>OAuth 7д</span><strong>{oauthLogins}</strong><small>входы</small></Card>
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Чеклист</h2></div>
            <div className="admin-dense-list always">
              {checks.map((check) => (
                <details className="admin-dense-row" key={check.label}>
                  <summary>
                    <span>{check.label}</span>
                    <b>{check.ok ? "OK" : "Нужно"}</b>
                    <em>{check.detail}</em>
                  </summary>
                  <div className="admin-dense-details">
                    <p>{check.ok ? "Настроено." : "Нужно добавить env-переменные в Vercel и сделать redeploy."}</p>
                  </div>
                </details>
              ))}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>Повторы устройств</h2></div>
            <div className="admin-dense-list always">
              {repeatedDevices.map((item) => (
                <details className="admin-dense-row" key={item.ipHash || "unknown"}>
                  <summary>
                    <span>{item.ipHash ? `${item.ipHash.slice(0, 12)}...` : "unknown"}</span>
                    <b>{item._count.ipHash}</b>
                    <em>24ч</em>
                  </summary>
                  <div className="admin-dense-details">
                    <p><b>IP hash:</b> {item.ipHash || "unknown"}</p>
                    <p><b>Событий за 24ч:</b> {item._count.ipHash}</p>
                  </div>
                </details>
              ))}
              {!repeatedDevices.length ? <p className="muted">Повторов за 24 часа нет.</p> : null}
            </div>
          </Card>
        </div>

        <Card className="admin-panel">
          <div className="section-head compact"><h2>Работы с риском</h2><Link href="/admin/content">Контент</Link></div>
          <div className="admin-table security-table">
            <div className="admin-table-head">
              <span>Работа</span>
              <span>Исполнитель</span>
              <span>Просмотры</span>
              <span>Статус</span>
              <span>Fraud</span>
            </div>
            {riskySubmissions.map((submission) => (
              <div className="admin-table-row" key={submission.id}>
                <div><strong><Link href={`/campaigns/${submission.campaign.id}`}>{submission.campaign.title}</Link></strong><span>{submission.postUrl}</span></div>
                <div><strong>@{submission.worker.handle}</strong><span>{submission.worker.email} · trust {submission.worker.trustScore}</span></div>
                <div><strong>{compactNumber(submission.currentViews)}</strong><span>цель {compactNumber(submission.campaign.viewThreshold)}</span></div>
                <div><Tag tone="soft">{statusLabel(submission.status)}</Tag></div>
                <div><Tag tone={submission.fraudScore >= 70 ? "warn" : "soft"}>{submission.fraudScore}%</Tag></div>
              </div>
            ))}
          </div>
          <div className="admin-dense-list">
            {riskySubmissions.map((submission) => (
              <details className="admin-dense-row" key={submission.id}>
                <summary>
                  <span>{submission.campaign.title}</span>
                  <b>{submission.fraudScore}%</b>
                  <em>@{submission.worker.handle}</em>
                </summary>
                <div className="admin-dense-details">
                  <p><b>Исполнитель:</b> {submission.worker.email} · trust {submission.worker.trustScore}</p>
                  <p><b>Статус:</b> {statusLabel(submission.status)}</p>
                  <p><b>Просмотры:</b> {compactNumber(submission.currentViews)} / {compactNumber(submission.campaign.viewThreshold)}</p>
                  <p><b>Ссылка:</b> {submission.postUrl}</p>
                  <p><Link href={`/campaigns/${submission.campaign.id}`}>Открыть заказ</Link></p>
                </div>
              </details>
            ))}
          </div>
          {!riskySubmissions.length ? <p className="muted">Высоких fraud score сейчас нет.</p> : null}
        </Card>

        <Card className="admin-panel">
          <div className="section-head compact"><h2>Входы</h2></div>
          <div className="admin-dense-list always">
            {recentSecurityEvents.map((event) => (
              <details className="admin-dense-row" key={event.id}>
                <summary>
                  <span>{event.user?.email || "Гость"}</span>
                  <b>{providerLabel(event.provider)}</b>
                  <em>{fullDate(event.createdAt)}</em>
                </summary>
                <div className="admin-dense-details">
                  <p><b>Тип:</b> {event.type}</p>
                  <p><b>Время:</b> {fullDate(event.createdAt)}</p>
                </div>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
