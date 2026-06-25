import Link from "next/link";
import { BarChart3, Eye, LockKeyhole, ShieldCheck, UserRound, Users } from "lucide-react";
import { AppShell, Card, Tag } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { compactNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    PAGE_VIEW: "Просмотр страницы",
    LOGIN_SUCCESS: "Вход",
    REGISTER_SUCCESS: "Регистрация",
    OAUTH_LOGIN: "Вход через соцсеть",
    OAUTH_REGISTER: "Регистрация через соцсеть",
    OAUTH_LINK: "Привязка соцсети",
    LOGOUT: "Выход",
    CTA_CLICK: "Клик"
  };
  return labels[type] || type;
}

function providerLabel(provider: string | null | undefined) {
  if (provider === "google") return "Google";
  if (provider === "vk") return "VK ID";
  if (provider === "yandex") return "Yandex";
  return "Обычный вход";
}

async function loadAdminStats() {
  const today = startOfDay();
  const week = daysAgo(7);
  const day = daysAgo(1);

  const [
    totalUsers,
    usersToday,
    usersWeek,
    totalCampaigns,
    totalSubmissions,
    googleLinks,
    oauthUsers,
    pageViewsDay,
    pageViewsWeek,
    activeUsersRaw,
    uniqueVisitorsRaw,
    providerGroups,
    topPages,
    recentUsers,
    recentEvents
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.campaign.count(),
    prisma.submission.count(),
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
    prisma.oAuthAccount.groupBy({ by: ["provider"], _count: { provider: true } }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { type: "PAGE_VIEW", path: { not: null }, createdAt: { gte: week } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 8
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { oauthAccounts: true }
    }),
    prisma.analyticsEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 18,
      include: { user: { select: { name: true, email: true, handle: true } } }
    })
  ]);

  return {
    totalUsers,
    usersToday,
    usersWeek,
    totalCampaigns,
    totalSubmissions,
    googleLinks,
    oauthUsers: oauthUsers.length,
    pageViewsDay,
    pageViewsWeek,
    activeUsersDay: activeUsersRaw.length,
    uniqueVisitorsDay: uniqueVisitorsRaw.length,
    providerGroups,
    topPages,
    recentUsers,
    recentEvents
  };
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const stats = await loadAdminStats();

  return (
    <AppShell hideBottomNav>
      <section className="section admin-screen">
        <div className="admin-hero">
          <div>
            <span className="eyebrow">Закрытая панель</span>
            <h1>Админка ReelPay</h1>
            <p>Пользователи, входы через Google, посещения страниц и свежая активность сайта. Доступ есть только у администратора.</p>
          </div>
          <div className="admin-lock">
            <ShieldCheck size={18} />
            <span>Вы вошли как {admin.email}</span>
          </div>
        </div>

        <div className="admin-grid">
          <Card className="admin-metric">
            <Users />
            <span>Всего пользователей</span>
            <strong>{stats.totalUsers}</strong>
            <small>+{stats.usersToday} сегодня · +{stats.usersWeek} за 7 дней</small>
          </Card>
          <Card className="admin-metric">
            <LockKeyhole />
            <span>Через Google</span>
            <strong>{stats.googleLinks}</strong>
            <small>{stats.oauthUsers} пользователей с соц-входом</small>
          </Card>
          <Card className="admin-metric">
            <Eye />
            <span>Просмотры за 24 часа</span>
            <strong>{compactNumber(stats.pageViewsDay)}</strong>
            <small>{stats.uniqueVisitorsDay} уникальных устройств</small>
          </Card>
          <Card className="admin-metric">
            <BarChart3 />
            <span>Активность</span>
            <strong>{stats.activeUsersDay}</strong>
            <small>{compactNumber(stats.pageViewsWeek)} просмотров за 7 дней</small>
          </Card>
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact">
              <h2>Способы входа</h2>
            </div>
            <div className="admin-bars">
              <div>
                <span>Обычные аккаунты</span>
                <b>{Math.max(0, stats.totalUsers - stats.oauthUsers)}</b>
              </div>
              {stats.providerGroups.map((item) => (
                <div key={item.provider}>
                  <span>{providerLabel(item.provider)}</span>
                  <b>{item._count.provider}</b>
                </div>
              ))}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact">
              <h2>Популярные страницы</h2>
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
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact">
              <h2>Последние пользователи</h2>
              <Link href="/profile">Мой профиль</Link>
            </div>
            <div className="admin-list">
              {stats.recentUsers.map((user) => (
                <div className="admin-user" key={user.id}>
                  <div className="order-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <Tag tone={user.oauthAccounts.some((account) => account.provider === "google") ? "good" : "soft"}>
                    {user.oauthAccounts.length ? user.oauthAccounts.map((account) => providerLabel(account.provider)).join(", ") : "Email"}
                  </Tag>
                </div>
              ))}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact">
              <h2>Последние события</h2>
            </div>
            <div className="admin-list">
              {stats.recentEvents.map((event) => (
                <div className="admin-event" key={event.id}>
                  <UserRound size={16} />
                  <div>
                    <strong>{eventLabel(event.type)} {event.provider ? `· ${providerLabel(event.provider)}` : ""}</strong>
                    <span>{event.user?.email || "Гость"} {event.path ? `· ${event.path}` : ""}</span>
                  </div>
                  <time>{event.createdAt.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
