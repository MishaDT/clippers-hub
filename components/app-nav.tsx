"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { CirclePlus, Handshake, Home, MessageCircle, Trophy, UserRound, WalletCards } from "lucide-react";

const items = [
  { href: "/campaigns", label: "Главная", icon: Home },
  { href: "/leaderboard", label: "Лидеры", icon: Trophy },
  { href: "/upload", label: "Выложить", icon: CirclePlus, primary: true },
  { href: "/chats", label: "Чаты", icon: MessageCircle },
  { href: "/profile", label: "Профиль", icon: UserRound }
];

const desktopItems = [
  items[0],
  items[1],
  { href: "/collabs", label: "Коллабы", icon: Handshake },
  items[2],
  items[3],
  { href: "/wallet", label: "Кошелек", icon: WalletCards },
  items[4]
];

function isActive(pathname: string, href: string) {
  if (href === "/campaigns") return pathname === href || pathname.startsWith("/campaigns/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav" aria-label="Навигация">
      {desktopItems.map(({ href, label, icon: Icon }) => (
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
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setPending(null);
  }, [pathname]);

  const currentHref = pending ?? items.find((item) => isActive(pathname, item.href))?.href ?? null;
  const activeIndex = currentHref ? Math.max(0, items.findIndex((item) => item.href === currentHref)) : 0;

  return (
    <nav
      className={clsx("bottom-nav", !currentHref && "no-active")}
      aria-label="Основная навигация"
      style={{ "--active-index": activeIndex, "--nav-items": items.length } as CSSProperties}
    >
      <span className="bottom-nav-indicator" aria-hidden="true" />
      {items.map(({ href, label, icon: Icon, primary }) => (
        <Link
          className={clsx(primary && "primary", currentHref === href && "active")}
          href={href}
          key={href}
          aria-label={label}
          title={label}
          onClick={() => setPending(href)}
        >
          <Icon size={primary ? 27 : 24} strokeWidth={2} />
          <span className="nav-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
