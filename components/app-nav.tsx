"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  BriefcaseBusiness,
  CirclePlus,
  Handshake,
  Home,
  MessageCircle,
  Trophy,
  UserRound,
  WalletCards
} from "lucide-react";
import styles from "@/components/app-nav.module.css";
type RoleMode = "worker" | "client";

const workerItems = [
  { href: "/campaigns", label: "Главная", icon: Home },
  { href: "/leaderboard", label: "Лидеры", icon: Trophy },
  { href: "/upload", label: "Выложить", icon: CirclePlus, primary: true },
  { href: "/chats", label: "Чаты", icon: MessageCircle },
  { href: "/profile", label: "Профиль", icon: UserRound }
];

const clientItems = [
  { href: "/campaigns", label: "Кампании", icon: BriefcaseBusiness },
  { href: "/leaderboard", label: "Исполнители", icon: Trophy },
  { href: "/campaigns/new", label: "Создать", icon: CirclePlus, primary: true },
  { href: "/chats", label: "Чаты", icon: MessageCircle },
  { href: "/profile", label: "Профиль", icon: UserRound }
];

function desktopItems(mode: RoleMode) {
  const items = mode === "client" ? clientItems : workerItems;
  return [
    items[0],
    ...(mode === "client"
      ? [
          { href: "/leaderboard", label: "Исполнители", icon: Trophy }
        ]
      : [
          { href: "/leaderboard", label: "Лидеры", icon: Trophy },
          { href: "/collabs", label: "Коллабы", icon: Handshake }
        ]),
    items[2],
    items[3],
    { href: "/wallet", label: "Кошелёк", icon: WalletCards },
    items[4]
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/campaigns") return pathname === href || (pathname.startsWith("/campaigns/") && pathname !== "/campaigns/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function formatBadgeCount(value: number) {
  if (value <= 0) return "";
  if (value <= 99) return String(value);
  if (value < 1000) return "99+";
  if (value < 10_000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
  return "9.9K+";
}

export function DesktopNav({ mode, unreadChats = 0 }: { mode: RoleMode; unreadChats?: number }) {
  const pathname = usePathname();

  return (
    <nav className="top-nav" aria-label="Навигация">
      {desktopItems(mode).map(({ href, label, icon: Icon }) => (
        <Link className={clsx(styles.link, isActive(pathname, href) && "active")} href={href} key={href}>
          <Icon size={16} />
          {label}
          {href === "/chats" && unreadChats ? <span className={styles.badge}>{formatBadgeCount(unreadChats)}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ mode, unreadChats = 0 }: { mode: RoleMode; unreadChats?: number }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const items = mode === "client" ? clientItems : workerItems;

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
          className={clsx(styles.link, primary && "primary", currentHref === href && "active")}
          href={href}
          key={href}
          aria-label={label}
          title={label}
          onClick={() => setPending(href)}
        >
          <Icon size={primary ? 27 : 24} strokeWidth={2} />
          <span className="nav-label">{label}</span>
          {href === "/chats" && unreadChats ? <span className={styles.badge}>{formatBadgeCount(unreadChats)}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
