import Link from "next/link";
import { AlertTriangle, CheckCircle2, Fingerprint, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
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

  const [riskySubmissions, repeatedDevices, oauthLogins, adminUsers, recentSecurityEvents] = await Promise.all([
    prisma.submission.findMany({
      where: { fraudScore: { gte: 50 } },
      include: {
        worker: { select: { email: true, handle: true, trustScore: true } },
        campaign: { select: { id: true, title: true, viewThreshold: true } }
      },
      orderBy: [{ fraudScore: "desc" }, { updatedAt: "desc" }],
      take: 12
    }),
    prisma.analyticsEvent.groupBy({
      by: ["ipHash"],
      where: { ipHash: { not: null }, createdAt: { gte: day } },
      _count: { ipHash: true },
      orderBy: { _count: { ipHash: "desc" } },
      take: 8
    }),
    prisma.analyticsEvent.count({ where: { type: { in: ["OAUTH_LOGIN", "OAUTH_REGISTER"] }, createdAt: { gte: week } } }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true, name: true, createdAt: true } }),
    prisma.analyticsEvent.findMany({
      where: { type: { in: ["LOGIN_SUCCESS", "OAUTH_LOGIN", "OAUTH_REGISTER", "OAUTH_LINK"] }, createdAt: { gte: week } },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 12
    })
  ]);

  const repeatedHigh = repeatedDevices.filter((item) => item._count.ipHash >= 20);
  const checks = [
    { label: "Google OAuth", ok: isConfigured("google"), detail: "Основной соц-вход" },
    { label: "VK ID OAuth", ok: isConfigured("vk"), detail: "Для RU-аудитории" },
    { label: "Yandex OAuth", ok: isConfigured("yandex"), detail: "Дополнительный вход" },
    { label: "SESSION_SECRET", ok: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16), detail: "Подпись сессий" },
    { label: "ANALYTICS_SALT", ok: Boolean(process.env.ANALYTICS_SALT), detail: "Хеширование IP/UA" },
    { label: "ADMIN_EMAILS", ok: Boolean(process.env.ADMIN_EMAILS), detail: "Доступ владельца" }
  ];

  return (
    <AdminShell>
      <div className="admin-screen">
        <AdminPageHeader
          eyebrow="Безопасность"
          title="Риски, доступы и антифрод"
          description="Место, где быстро видно подозрительные работы, повторяющиеся устройства, настройки OAuth и админский доступ."
        />

        <div className="admin-grid compact">
          <Card className="admin-metric"><ShieldAlert /><span>Fraud 50+</span><strong>{riskySubmissions.length}</strong><small>работ требуют просмотра</small></Card>
          <Card className="admin-metric"><Fingerprint /><span>Повторы 24ч</span><strong>{repeatedHigh.length}</strong><small>устройств с частой активностью</small></Card>
          <Card className="admin-metric"><KeyRound /><span>OAuth за 7 дней</span><strong>{oauthLogins}</strong><small>входы и регистрации</small></Card>
          <Card className="admin-metric"><ShieldCheck /><span>Админы</span><strong>{adminUsers.length}</strong><small>роль ADMIN в базе</small></Card>
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Чеклист защиты</h2></div>
            <div className="admin-list">
              {checks.map((check) => (
                <div className="admin-event" key={check.label}>
                  {check.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <div>
                    <strong>{check.label}</strong>
                    <span>{check.detail}</span>
                  </div>
                  <Tag tone={check.ok ? "good" : "warn"}>{check.ok ? "OK" : "Нужно"}</Tag>
                </div>
              ))}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>Повторяющиеся устройства</h2></div>
            <div className="admin-list">
              {repeatedDevices.map((item) => (
                <div className="admin-row" key={item.ipHash || "unknown"}>
                  <span>{item.ipHash ? `${item.ipHash.slice(0, 12)}...` : "unknown"}</span>
                  <b>{item._count.ipHash}</b>
                </div>
              ))}
              {!repeatedDevices.length ? <p className="muted">За последние 24 часа повторов нет.</p> : null}
            </div>
          </Card>
        </div>

        <Card className="admin-panel">
          <div className="section-head compact">
            <h2>Работы с риском</h2>
            <Link href="/admin/content">Контент</Link>
          </div>
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
                <div>
                  <strong><Link href={`/campaigns/${submission.campaign.id}`}>{submission.campaign.title}</Link></strong>
                  <span>{submission.postUrl}</span>
                </div>
                <div>
                  <strong>@{submission.worker.handle}</strong>
                  <span>{submission.worker.email} · trust {submission.worker.trustScore}</span>
                </div>
                <div>
                  <strong>{compactNumber(submission.currentViews)}</strong>
                  <span>цель {compactNumber(submission.campaign.viewThreshold)}</span>
                </div>
                <div><Tag tone="soft">{statusLabel(submission.status)}</Tag></div>
                <div><Tag tone={submission.fraudScore >= 70 ? "warn" : "soft"}>{submission.fraudScore}%</Tag></div>
              </div>
            ))}
          </div>
          {!riskySubmissions.length ? <p className="muted">Высоких fraud score сейчас нет.</p> : null}
        </Card>

        <Card className="admin-panel">
          <div className="section-head compact"><h2>Последние события входа</h2></div>
          <div className="admin-list">
            {recentSecurityEvents.map((event) => (
              <div className="admin-event" key={event.id}>
                <KeyRound size={16} />
                <div>
                  <strong>{event.user?.email || "Гость"}</strong>
                  <span>{providerLabel(event.provider)} · {event.type}</span>
                </div>
                <time>{fullDate(event.createdAt)}</time>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
