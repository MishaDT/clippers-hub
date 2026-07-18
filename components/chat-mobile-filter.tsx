"use client";

import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./chat-mobile-filter.module.css";
import { useModalFocus } from "./use-modal-focus";

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
  const activeCount = [...roleItems.slice(1), ...statusItems.slice(1)].filter((item) => item.active).length;

  const close = useCallback(() => {
    if (history.state?.reelpayChatFilters) history.back();
    else setOpen(false);
  }, []);
  const dialogRef = useModalFocus<HTMLDivElement>(open, close);

  useEffect(() => {
    const onPopState = () => {
      setOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

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
      <button className={styles.trigger} type="button" aria-label="Фильтры" title="Фильтры" aria-expanded={open} onClick={toggle}>
        <SlidersHorizontal size={18} />
        {activeCount ? <b>{activeCount}</b> : null}
      </button>
      {open ? (
        <div className="chat-filter-layer" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <div ref={dialogRef} tabIndex={-1} className="chat-mobile-filter-sheet" role="dialog" aria-modal="true" aria-label="Фильтры чатов">
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
