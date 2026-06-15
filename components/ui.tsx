import Link from "next/link";
import { clsx } from "clsx";
import { BriefcaseBusiness, Search, Zap } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { BottomNav, DesktopNav } from "@/components/app-nav";

export async function AppShell({ children, hideBottomNav = false }: { children: React.ReactNode; hideBottomNav?: boolean }) {
  const user = await getCurrentUser();
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
              <Link className="role-pill" href="/profile"><Zap size={16} /> {roleLabel}</Link>
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
      <main className="content">{children}</main>
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
