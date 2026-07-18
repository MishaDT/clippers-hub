"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, CircleHelp, MessageCircle, Upload, WalletCards, X } from "lucide-react";
import styles from "./mascot.module.css";
import { useModalFocus } from "./use-modal-focus";

type Action = { label: string; href: string; hint: string; icon: "work" | "chat" | "upload" | "wallet" | "help" };
type SmartAction = Action & { id: string; priority: number };

function actionsFor(pathname: string, mode: "worker" | "client"): Action[] {
  if (pathname === "/wallet") return [
    { label: "Операции", href: "/wallet?tab=operations", hint: "История денег", icon: "wallet" },
    { label: "Резерв", href: "/wallet?tab=reserved", hint: "Замороженные средства", icon: "wallet" },
    { label: "Как работают RP", href: "/help/rp", hint: "Бонусы и конвертация", icon: "help" }
  ];
  if (pathname === "/campaigns/new") return [
    { label: "Проверить исходник", href: "#source", hint: "Ссылка и права", icon: "work" },
    { label: "Бюджет заказа", href: "#budget", hint: "Ставка и выплата", icon: "wallet" }
  ];
  if (/^\/campaigns\/[^/]+$/.test(pathname)) return [
    { label: mode === "client" ? "Обсуждение" : "Продолжить заказ", href: "/chats", hint: "Чат и статус", icon: "chat" },
    { label: "Условия выплаты", href: "#payment", hint: "Цель и проверка", icon: "wallet" }
  ];
  if (pathname === "/campaigns") return mode === "client"
    ? [
        { label: "Создать заказ", href: "/campaigns/new", hint: "Новый бриф", icon: "work" },
        { label: "Открыть бюджет", href: "/wallet", hint: "Баланс кампаний", icon: "wallet" }
      ]
    : [
        { label: "Найти заказ", href: "#orders", hint: "Поиск и фильтры", icon: "work" },
        { label: "Сдать ролик", href: "/upload", hint: "Отправить работу", icon: "upload" }
      ];
  return [
    { label: "Заказы", href: "/campaigns", hint: "Рабочая зона", icon: "work" },
    { label: "Сообщения", href: "/chats", hint: "Заказы и коллабы", icon: "chat" }
  ];
}

const ICONS = {
  work: BriefcaseBusiness,
  chat: MessageCircle,
  upload: Upload,
  wallet: WalletCards,
  help: CircleHelp
};

function readDismissed() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem("ridzi-dismissed") || "[]"));
  } catch {
    return new Set<string>();
  }
}

function trackSuggestion(type: "RIDZI_SUGGESTION_CLICK" | "RIDZI_SUGGESTION_DISMISS", id: string, pathname: string) {
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ type, path: pathname, metadata: { suggestionId: id } })
  });
}

export function Mascot() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"worker" | "client">("worker");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const blocked = pathname === "/login" || pathname === "/register" || pathname === "/chats";
  const dialogRef = useModalFocus<HTMLElement>(open, () => setOpen(false));

  useEffect(() => {
    setMounted(true);
    setMode(document.cookie.includes("rp_role_mode=client") ? "client" : "worker");
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const dismissed = readDismissed();
    const controller = new AbortController();
    fetch("/api/ridzi/context", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { suggestions?: SmartAction[] }) => setSmartActions((data.suggestions || []).filter((item) => !dismissed.has(item.id))))
      .catch(() => setSmartActions([]));
    return () => controller.abort();
  }, [open, pathname]);

  if (blocked) return null;
  const actions = smartActions.length ? smartActions : actionsFor(pathname, mode);
  const sheet = open && mounted ? createPortal(
    <div className="ridzi-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section ref={dialogRef} tabIndex={-1} className="ridzi-sheet" role="dialog" aria-modal="true" aria-label="Помощник Ридзи">
        <header>
          <div><span className="ridzi-mini">R</span><div><b>Ридзи</b><small>{mode === "client" ? "Помощник заказчика" : "Помощник исполнителя"}</small></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={19} /></button>
        </header>
        <div className="ridzi-actions">
          {actions.map((action) => {
            const Icon = ICONS[action.icon];
            const smart = "id" in action && typeof action.id === "string" ? action as SmartAction : null;
            return (
              <div className={styles.action} key={smart?.id || action.label}>
                <Link href={action.href} onClick={() => {
                  if (smart) trackSuggestion("RIDZI_SUGGESTION_CLICK", smart.id, pathname);
                  setOpen(false);
                }}>
                  <span><Icon size={19} /></span>
                  <div><strong>{action.label}</strong><small>{action.hint}</small></div>
                </Link>
                {smart ? <button type="button" onClick={() => {
                  const dismissed = readDismissed();
                  dismissed.add(smart.id);
                  localStorage.setItem("ridzi-dismissed", JSON.stringify([...dismissed].slice(-50)));
                  trackSuggestion("RIDZI_SUGGESTION_DISMISS", smart.id, pathname);
                  setSmartActions((items) => items.filter((item) => item.id !== smart.id));
                }}>Не показывать</button> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {sheet}
      <div className="mascot">
        <button className="mascot-body" type="button" aria-label="Открыть помощника Ридзи" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <svg viewBox="0 0 72 72" width="58" height="58" aria-hidden="true">
            <rect x="13" y="15" width="46" height="43" rx="15" fill="#ef4444" />
            <rect x="19" y="23" width="34" height="27" rx="11" fill="#321014" />
            <circle cx="29" cy="35" r="5.2" fill="#fff" /><circle cx="43" cy="35" r="5.2" fill="#fff" />
            <circle cx="30" cy="36" r="2.5" fill="#111" /><circle cx="44" cy="36" r="2.5" fill="#111" />
            <path d="M30 44q6 4.5 12 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M13 38a23 21 0 0 1 46 0" fill="none" stroke="#fb7185" strokeWidth="4.5" />
            <line x1="36" y1="13" x2="36" y2="5" stroke="#fb7185" strokeWidth="2.6" /><circle cx="36" cy="4" r="3.2" fill="#fb7185" />
          </svg>
        </button>
      </div>
    </>
  );
}
