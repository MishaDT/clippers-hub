import Link from "next/link";
import { unstable_cache } from "next/cache";
import { clsx } from "clsx";
import { Bell, BriefcaseBusiness, Search, ShieldCheck, Zap } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { canAccessAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomNav, DesktopNav } from "@/components/app-nav";
import { SiteFooter } from "@/components/site-footer";

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
  const adminAlerts = isAdmin && user
    ? await loadAdminAlerts(user.id)
    : 0;
  const roleLabel = user?.role === "CLIENT" ? "Заказчик" : user?.role === "ADMIN" ? "Админ" : "Исполнитель";

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-word">Reel<span>Pay</span></span>
        </Link>
        <DesktopNav />
        <div className="top-actions">
          {user ? (
            <>
              {isAdmin ? <Link className="role-pill admin-link" href="/admin"><ShieldCheck size={16} /> <span>Admin</span></Link> : null}
              {isAdmin ? (
                <Link className="role-pill admin-bell" href="/admin/security" aria-label="Модерация">
                  <Bell size={16} />
                  <span>{adminAlerts}</span>
                </Link>
              ) : null}
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
      {user && !hideBottomNav ? <BottomNav /> : null}
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
