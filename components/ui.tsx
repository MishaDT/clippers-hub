import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { BriefcaseBusiness, LogOut, Menu, Search, ShieldCheck, Zap } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { canAccessAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { BottomNav, DesktopNav } from "@/components/app-nav";
import { SiteFooter } from "@/components/site-footer";
import { getActiveRoleMode } from "@/lib/role-mode";
import { getUnreadSummary } from "@/lib/unread";
import { NotificationBell } from "@/components/notification-bell";
import { ReadStateTracker } from "@/components/read-state-tracker";
import { RoleModeSwitcher } from "@/components/role-mode-switcher";
import { Mascot } from "@/components/mascot";
import styles from "./app-shell.module.css";

export async function AppShell({
  children,
  hideBottomNav = false,
  hideFooter = false,
  immersive = false
}: {
  children: React.ReactNode;
  hideBottomNav?: boolean;
  hideFooter?: boolean;
  immersive?: boolean;
}) {
  const user = await getCurrentUser();
  const isAdmin = canAccessAdmin(user);
  const mode = user ? await getActiveRoleMode(user) : "worker";
  const unread = user
    ? await getUnreadSummary(user.id)
    : { chats: 0, support: 0, chatBadge: 0, notifications: 0, adminAlerts: 0 };
  const roleLabel = mode === "client" ? "Заказчик" : "Исполнитель";

  return (
    <>
      <header className={clsx("topbar", styles.header)}>
        <Link className="brand" href="/">
          <span className="brand-word">Reel<span>Pay</span></span>
        </Link>
        {user ? (
          <DesktopNav mode={mode} unreadChats={unread.chatBadge} />
        ) : (
          <nav className="public-nav" aria-label="Навигация">
            <Link href="/#how">Как это работает</Link>
            <Link href="/campaigns">Заказы</Link>
            <Link href="/business">Для бизнеса</Link>
            <Link href="/leaderboard">Лидеры</Link>
          </nav>
        )}
        <div className={clsx("top-actions", styles.actions)}>
          {user ? (
            <>
              {isAdmin ? <Link className={clsx("role-pill admin-link", styles.admin)} href="/admin" aria-label="Открыть админку"><ShieldCheck size={16} /> <span>Admin</span>{unread.adminAlerts ? <b className={clsx("admin-alert-badge", styles.adminBadge)} title={`${unread.adminAlerts} важных событий`}>{unread.adminAlerts > 99 ? "99+" : unread.adminAlerts}</b> : null}</Link> : null}
              <NotificationBell unread={unread.notifications} />
              {user.role === "BOTH" || user.role === "ADMIN" ? (
                <Suspense fallback={<Link className="role-pill" href="/profile"><Zap size={16} /> <span>{roleLabel}</span></Link>}>
                  <RoleModeSwitcher mode={mode} />
                </Suspense>
              ) : (
                <Link className="role-pill" href="/profile"><Zap size={16} /> <span>{roleLabel}</span></Link>
              )}
              <form action={logoutAction} className={styles.logoutForm}>
                <button className={clsx("btn btn-small btn-ghost", styles.logout)} type="submit" aria-label="Выйти из аккаунта"><LogOut size={16} /><span>Выйти</span></button>
              </form>
            </>
          ) : (
            <>
              <details className="public-mobile-menu">
                <summary aria-label="Открыть меню"><Menu size={19} /></summary>
                <nav aria-label="Мобильная навигация">
                  <Link href="/#how">Как работает ReelPay</Link>
                  <Link href="/campaigns">Открытые заказы</Link>
                  <Link href="/business">Запустить кампанию</Link>
                  <Link href="/leaderboard">Доска лидеров</Link>
                  <Link href="/safety/budget">Защита бюджета</Link>
                </nav>
              </details>
              <Link className="btn btn-small btn-ghost" href="/login">Войти</Link>
              <Link className="btn btn-small btn-primary" href="/register">Начать</Link>
            </>
          )}
        </div>
      </header>
      <main className={clsx("content", immersive && "content-immersive")}>
        {children}
        {!immersive && !hideFooter ? <SiteFooter /> : null}
      </main>
      {user ? <Suspense fallback={null}><ReadStateTracker /></Suspense> : null}
      {user && !hideBottomNav ? <BottomNav mode={mode} unreadChats={unread.chatBadge} /> : null}
      {!immersive ? <Mascot authenticated={Boolean(user)} initialMode={mode} /> : null}
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

export function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={clsx("card", className)}>{children}</section>;
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
