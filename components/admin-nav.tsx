"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, DatabaseZap, ShieldAlert, SlidersHorizontal, UsersRound } from "lucide-react";
import { clsx } from "clsx";

const items = [
  { href: "/admin", label: "Обзор", hint: "Главные цифры", icon: BarChart3 },
  { href: "/admin/users", label: "Пользователи", hint: "Поиск и роли", icon: UsersRound },
  { href: "/admin/activity", label: "События", hint: "Посещения и входы", icon: ClipboardList },
  { href: "/admin/content", label: "Контент", hint: "Заказы и работы", icon: DatabaseZap },
  { href: "/admin/security", label: "Безопасность", hint: "Риски и контроль", icon: ShieldAlert },
  { href: "/admin/settings", label: "Настройки", hint: "Интеграции", icon: SlidersHorizontal }
];

function active(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar" aria-label="Админ меню">
      <div className="admin-sidebar-head">
        <strong>Control</strong>
        <span>ReelPay admin</span>
      </div>
      <nav className="admin-menu">
        {items.map(({ href, label, hint, icon: Icon }) => (
          <Link className={clsx(active(pathname, href) && "active")} href={href} key={href}>
            <Icon size={18} />
            <span>
              <b>{label}</b>
              <small>{hint}</small>
            </span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
