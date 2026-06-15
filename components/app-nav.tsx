"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { CirclePlus, Home, Search, UserRound, WalletCards } from "lucide-react";

const items = [
  { href: "/feed", label: "Лента", icon: Home },
  { href: "/campaigns", label: "Заказы", icon: Search },
  { href: "/upload", label: "Выложить", icon: CirclePlus, primary: true },
  { href: "/wallet", label: "Кошелек", icon: WalletCards },
  { href: "/profile", label: "Профиль", icon: UserRound }
];

function isActive(pathname: string, href: string) {
  if (href === "/campaigns") return pathname === href || pathname.startsWith("/campaigns/");
  return pathname === href;
}

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav" aria-label="Навигация">
      {items.map(({ href, label, icon: Icon }) => (
        <Link className={clsx(isActive(pathname, href) && "active")} href={href} key={href}>
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(0, items.findIndex((item) => isActive(pathname, item.href)));

  return (
    <nav className="bottom-nav" aria-label="Основная навигация" style={{ "--active-index": activeIndex } as CSSProperties}>
      <span className="bottom-nav-indicator" aria-hidden="true" />
      {items.map(({ href, label, icon: Icon, primary }) => (
        <Link
          className={clsx(primary && "primary", isActive(pathname, href) && "active")}
          href={href}
          key={href}
          aria-label={label}
          title={label}
        >
          <Icon size={primary ? 28 : 24} strokeWidth={2.2} />
          <span className={clsx(primary ? "sr-only" : "nav-label")}>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
