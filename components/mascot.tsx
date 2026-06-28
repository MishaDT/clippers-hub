"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Action = { label: string; href: string; hint: string };

function actionsFor(pathname: string, mode: "worker" | "client"): Action[] {
  if (pathname === "/wallet") return [
    { label: "Открыть операции", href: "/wallet?tab=operations", hint: "Все движения денег и их статусы." },
    { label: "Проверить резерв", href: "/wallet?tab=reserved", hint: "Средства кампаний и выплаты на проверке." },
    { label: "Разобраться с RP", href: "/help/rp", hint: "Курс, бонусы и обратная конвертация." }
  ];
  if (pathname === "/campaigns/new") return [
    { label: "Проверить исходник", href: "#source", hint: "Ссылка, права и безопасное превью." },
    { label: "Проверить бюджет", href: "#budget", hint: "Цель, ставка и ожидаемая выплата." }
  ];
  if (/^\/campaigns\/[^/]+$/.test(pathname)) return [
    { label: mode === "client" ? "Открыть обсуждение" : "Продолжить заказ", href: "/chats", hint: "Чат и текущий статус работы." },
    { label: "Объяснить выплату", href: "#payment", hint: "Цель, ставка и срок проверки." }
  ];
  if (pathname === "/campaigns") return mode === "client"
    ? [{ label: "Создать заказ", href: "/campaigns/new", hint: "Новый бриф для исполнителей." }, { label: "Открыть бюджет", href: "/wallet", hint: "Баланс и резерв кампаний." }]
    : [{ label: "Найти подходящий заказ", href: "#orders", hint: "Поиск и фильтры витрины." }, { label: "Моя текущая работа", href: "/upload", hint: "Сдать готовый ролик." }];
  return [
    { label: "Заказы", href: "/campaigns", hint: "Текущая рабочая зона." },
    { label: "Сообщения", href: "/chats", hint: "Обсуждения заказов и коллабов." }
  ];
}

export function Mascot() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"worker" | "client">("worker");
  const [open, setOpen] = useState(false);
  const blocked = pathname === "/login" || pathname === "/register" || pathname === "/chats";

  useEffect(() => {
    setMode(document.cookie.includes("rp_role_mode=client") ? "client" : "worker");
    setOpen(false);
  }, [pathname]);

  if (blocked) return null;
  const actions = actionsFor(pathname, mode);

  return (
    <div className={`mascot ${open ? "is-open" : ""}`}>
      {open ? (
        <div className="mascot-action-sheet" role="dialog" aria-label="Помощник Ридзи">
          <div><b>Что сделать дальше</b><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть">×</button></div>
          {actions.map((action) => (
            <Link href={action.href} key={action.label} onClick={() => setOpen(false)}>
              <strong>{action.label}</strong><span>{action.hint}</span>
            </Link>
          ))}
        </div>
      ) : null}
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
  );
}
