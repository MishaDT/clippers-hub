import Link from "next/link";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { clsx } from "clsx";
import { BriefcaseBusiness, Search, ShieldCheck, Zap } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { canAccessAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomNav, DesktopNav } from "@/components/app-nav";
import { SiteFooter } from "@/components/site-footer";
import { getActiveRoleMode } from "@/lib/role-mode";
import { getUnreadSummary } from "@/lib/unread";
import { NotificationBell } from "@/components/notification-bell";
import { ReadStateTracker } from "@/components/read-state-tracker";

const loadAdminAlerts = unstable_cache(
  (userId: string) => prisma.notification.count({
    where: { userId, readAt: null, priority: "HIGH" }
  }),
  ["admin-alert-count-v1"],
  { revalidate: 15, tags: ["admin-alerts"] }
);

export async function AppShell({
  children,
  hideBottomNav = false,
  immersive = false,
  publicOnly = false
}: {
  children: React.ReactNode;
  hideBottomNav?: boolean;
  immersive?: boolean;
  publicOnly?: boolean;
}) {
  const user = publicOnly ? null : await getCurrentUser();
  const isAdmin = canAccessAdmin(user);
  const mode = user ? await getActiveRoleMode(user) : "worker";
  const [adminAlerts, unread, notifications] = user
    ? await Promise.all([
        isAdmin ? loadAdminAlerts(user.id) : Promise.resolve(0),
        getUnreadSummary(user.id),
        prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true }
        })
      ])
    : [0, { chats: 0, support: 0, chatBadge: 0, notifications: 0 }, []];
  const roleLabel = mode === "client" ? "Заказчик" : "Исполнитель";

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-word">Reel<span>Pay</span></span>
        </Link>
        {user ? <DesktopNav mode={mode} unreadChats={unread.chatBadge} /> : null}
        <div className="top-actions">
          {user ? (
            <>
              {isAdmin ? <Link className="role-pill admin-link" href="/admin"><ShieldCheck size={16} /> <span>Admin</span></Link> : null}
              <NotificationBell
                unread={unread.notifications}
                items={notifications.map((item) => ({
                  id: item.id,
                  title: item.title,
                  body: item.body,
                  href: item.href,
                  read: Boolean(item.readAt),
                  createdAt: item.createdAt.toLocaleString("ru-RU", { day: "2-digit", month: "short" })
                }))}
              />
              {isAdmin && adminAlerts ? <Link className="role-pill admin-bell" href="/admin/security" aria-label="Важные события">{adminAlerts}</Link> : null}
              <Link className="role-pill" href="/profile"><Zap size={16} /> <span>{roleLabel}</span></Link>
              <form action={logoutAction}>
                <button className="btn btn-small btn-ghost" type="submit">Выйти</button>
              </form>
            </>
          ) : (
            <>
              <Link className="btn btn-small btn-ghost" href="/login">Войти</Link>
              <Link className="btn btn-small btn-primary" href="/register">Начать</Link>
            </>
          )}
        </div>
      </header>
      <main className={clsx("content", immersive && "content-immersive")}>
        {children}
        {!immersive ? <SiteFooter /> : null}
      </main>
      {user ? <Suspense fallback={null}><ReadStateTracker /></Suspense> : null}
      {user && !hideBottomNav ? <BottomNav mode={mode} unreadChats={unread.chatBadge} /> : null}
    </>
  );
}

export function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={clsx("metric", tone)}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("card", className)}>{children}</section>;
}

export function Tag({ children, tone }: { children: React.ReactNode; tone?: "good" | "warn" | "live" | "soft" }) {
  return <span className={clsx("tag", tone)}>{children}</span>;
}

export function RoleChoice() {
  return (
    <div className="role-choice">
      <Link className="role-card client-role" href="/campaigns/new">
        <span>Я заказчик</span>
        <strong>Создаю кампании и получаю готовые видео</strong>
        <ul>
          <li>Публикуйте задания</li>
          <li>Получайте качественные клипы</li>
          <li>Смотрите аналитику</li>
        </ul>
        <em><BriefcaseBusiness size={17} /> Создать заказ</em>
      </Link>
      <Link className="role-card worker-role" href="/campaigns">
        <span>Я клиппер</span>
        <strong>Выполняю заказы и зарабатываю на роликах</strong>
        <ul>
          <li>Находите интересные заказы</li>
          <li>Создавайте короткие видео</li>
          <li>Получайте вознаграждение</li>
        </ul>
        <em><Search size={17} /> Найти заказ</em>
      </Link>
    </div>
  );
}
