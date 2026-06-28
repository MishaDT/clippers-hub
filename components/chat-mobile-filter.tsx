"use client";

import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Item = { label: string; href: string; active: boolean; count?: number };

export function ChatMobileFilter({
  typeItems,
  roleItems,
  statusItems
}: {
  typeItems: Item[];
  roleItems: Item[];
  statusItems: Item[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    if (history.state?.reelpayChatFilters) history.back();
    else setOpen(false);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  function toggle() {
    if (open) return close();
    history.pushState({ ...history.state, reelpayChatFilters: true }, "", location.href);
    setOpen(true);
  }

  function navigate(href: string) {
    setOpen(false);
    router.replace(href);
  }

  const section = (title: string, items: Item[]) => items.length ? (
    <section>
      <strong>{title}</strong>
      <nav>
        {items.map((item) => (
          <button className={item.active ? "active" : ""} type="button" onClick={() => navigate(item.href)} key={item.label}>
            {item.label}{typeof item.count === "number" ? <b>{item.count}</b> : null}
          </button>
        ))}
      </nav>
    </section>
  ) : null;

  return (
    <div className="chat-mobile-filter">
      <button className="chat-mobile-filter-trigger" type="button" aria-label="Фильтры" aria-expanded={open} onClick={toggle}>
        <SlidersHorizontal size={18} />
      </button>
      {open ? (
        <div className="chat-filter-layer" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <div className="chat-mobile-filter-sheet" role="dialog" aria-modal="true" aria-label="Фильтры чатов">
            <header><b>Фильтры</b><button type="button" onClick={close} aria-label="Закрыть"><X size={20} /></button></header>
            {section("Тип", typeItems)}
            {section("Моя роль", roleItems)}
            {section("Статус", statusItems)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
