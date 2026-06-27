import Link from "next/link";
import { unstable_cache } from "next/cache";
import { AlertTriangle, ArrowRight, BarChart3, Eye, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";
import { eventLabel, providerLabel, shortDate } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const loadAdminStats = unstable_cache(async () => {
  const today = startOfDay();
  const week = daysAgo(7);
  const day = daysAgo(1);

  const [
    totalUsers,
    usersToday,
    usersWeek,
    totalCampaigns,
    activeCampaigns,
    totalSubmissions,
    riskySubmissions,
    pendingPayouts,
    googleLinks,
    oauthUsers,
    pageViewsDay,
    pageViewsWeek,
    activeUsersRaw,
    uniqueVisitorsRaw,
    topPages,
    recentEvents
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.campaign.count(),
    prisma.campaign.count({ where: { status: { in: ["ACTIVE", "LOW_BUDGET"] } } }),
    prisma.submission.count(),
    prisma.submission.count({ where: { fraudScore: { gte: 60 } } }),
    prisma.transaction.aggregate({ where: { status: "PENDING" }, _sum: { netCents: true }, _count: true }),
    prisma.oAuthAccount.count({ where: { provider: "google" } }),
    prisma.oAuthAccount.findMany({ distinct: ["userId"], select: { userId: true } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: day } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: week } } }),
    prisma.analyticsEvent.findMany({
      where: { userId: { not: null }, createdAt: { gte: day } },
      distinct: ["userId"],
      select: { userId: true }
    }),
    prisma.analyticsEvent.findMany({
      where: { type: "PAGE_VIEW", ipHash: { not: null }, createdAt: { gte: day } },
      distinct: ["ipHash"],
      select: { ipHash: true }
    }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { type: "PAGE_VIEW", path: { not: null }, createdAt: { gte: week } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 6
    }),
    prisma.analyticsEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { email: true } } }
    })
  ]);

  return {
    totalUsers,
    usersToday,
    usersWeek,
    totalCampaigns,
    activeCampaigns,
    totalSubmissions,
    riskySubmissions,
    pendingPayoutCents: pendingPayouts._sum.netCents || 0,
    pendingPayoutCount: pendingPayouts._count,
    googleLinks,
    oauthUsers: oauthUsers.length,
    pageViewsDay,
    pageViewsWeek,
    activeUsersDay: activeUsersRaw.length,
    uniqueVisitorsDay: uniqueVisitorsRaw.length,
    topPages,
    recentEvents
  };
}, ["admin-dashboard-v2"], { revalidate: 30, tags: ["admin-dashboard"] });

export default async function AdminPage() {
  const stats = await loadAdminStats();

  return (
    <AdminShell>
      <div className="admin-screen">
        <AdminPageHeader
          eyebrow="Закрытая панель"
          title="Центр управления ReelPay"
          description="Смотри рост, входы, активность, контент, выплаты и риски. Действия пока безопасные: диагностика и контроль без опасных массовых операций."
          action={<Link className="btn btn-primary" href="/admin/users">Пользователи <ArrowRight size={16} /></Link>}
        />

        <div className="admin-grid">
          <Card className="admin-metric">
            <Users />
            <span>Пользователи</span>
            <strong>{stats.totalUsers}</strong>
            <small>+{stats.usersToday} сегодня · +{stats.usersWeek} за неделю</small>
          </Card>
          <Card className="admin-metric">
            <LockKeyhole />
            <span>Google-вход</span>
            <strong>{stats.googleLinks}</strong>
            <small>{stats.oauthUsers} с соц-авторизацией</small>
          </Card>
          <Card className="admin-metric">
            <Eye />
            <span>Просмотры 24ч</span>
            <strong>{compactNumber(stats.pageViewsDay)}</strong>
            <small>{stats.uniqueVisitorsDay} устройств · {stats.activeUsersDay} вошли</small>
          </Card>
          <Card className="admin-metric">
            <BarChart3 />
            <span>Контент</span>
            <strong>{stats.activeCampaigns}/{stats.totalCampaigns}</strong>
            <small>{stats.totalSubmissions} работ на платформе</small>
          </Card>
        </div>

        <div className="admin-command-grid">
          <Link className="admin-command-card" href="/admin/security">
            <AlertTriangle size={20} />
            <strong>{stats.riskySubmissions}</strong>
            <span>работ с fraud score 60+</span>
            <em>Открыть риски</em>
          </Link>
          <Link className="admin-command-card" href="/admin/content">
            <ShieldCheck size={20} />
            <strong>{rub(stats.pendingPayoutCents)}</strong>
            <span>{stats.pendingPayoutCount} ожидающих операций</span>
            <em>Проверить контент</em>
          </Link>
          <Link className="admin-command-card" href="/admin/activity">
            <Eye size={20} />
            <strong>{compactNumber(stats.pageViewsWeek)}</strong>
            <span>просмотров страниц за неделю</span>
            <em>Открыть события</em>
          </Link>
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact">
              <h2>Популярные страницы</h2>
              <Link href="/admin/activity">Все события</Link>
            </div>
            <div className="admin-list">
              {stats.topPages.length ? stats.topPages.map((page) => (
                <div className="admin-row" key={page.path || "unknown"}>
                  <span>{page.path || "unknown"}</span>
                  <b>{page._count.path}</b>
                </div>
              )) : <p className="muted">Данные появятся после первых посещений.</p>}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact">
              <h2>Последние события</h2>
              <Link href="/admin/activity">Журнал</Link>
            </div>
            <div className="admin-list">
              {stats.recentEvents.map((event) => (
                <div className="admin-event" key={event.id}>
                  <ShieldCheck size={16} />
                  <div>
                    <strong>{eventLabel(event.type)} {event.provider ? `· ${providerLabel(event.provider)}` : ""}</strong>
                    <span>{event.user?.email || "Гость"} {event.path ? `· ${event.path}` : ""}</span>
                  </div>
                  <time>{shortDate(event.createdAt)}</time>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="admin-panel">
          <div className="section-head compact">
            <h2>Быстрые переходы</h2>
          </div>
          <div className="admin-quick-grid">
            <Link href="/admin/users"><b>Пользователи</b><span>Поиск, роли, соц-вход, балансы</span></Link>
            <Link href="/admin/activity"><b>События</b><span>Входы, регистрации, просмотры страниц</span></Link>
            <Link href="/admin/content"><b>Контент</b><span>Заказы, работы, бюджеты, выплаты</span></Link>
            <Link href="/admin/security"><b>Безопасность</b><span>Fraud score, повторы устройств, чеклист</span></Link>
            <Link href="/admin/settings"><b>Настройки</b><span>OAuth, база, платежи, интеграции</span></Link>
            <Link href="/legal/cookies"><b>Прозрачность</b><span>Что собираем и зачем</span></Link>
          </div>
        </Card>

        <div className="admin-note">
          <Tag tone="good">Безопасный режим</Tag>
          <span>Админка сейчас ничего не удаляет и не меняет деньги. Это правильно для первого этапа: сначала наблюдаем и находим проблемы.</span>
        </div>
      </div>
    </AdminShell>
  );
}
