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
  PlaySquare,
  Trophy,
  UserRound,
  WalletCards
} from "lucide-react";
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
  { href: "/feed", label: "Ролики", icon: PlaySquare },
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
          { href: "/feed", label: "Ролики", icon: PlaySquare },
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

export function DesktopNav({ mode }: { mode: RoleMode }) {
  const pathname = usePathname();

  return (
    <nav className="top-nav" aria-label="Навигация">
      {desktopItems(mode).map(({ href, label, icon: Icon }) => (
        <Link className={clsx(isActive(pathname, href) && "active")} href={href} key={href}>
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ mode }: { mode: RoleMode }) {
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
