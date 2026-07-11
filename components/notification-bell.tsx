"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/notifications/actions";
import { formatBadgeCount } from "@/components/app-nav";
import { occurrenceLabel } from "@/lib/notification-logic";
import styles from "@/components/notification-bell.module.css";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  occurrenceCount: number;
  createdAt: string;
};

// The badge count comes from the (cheap) shell summary; the list itself is fetched only when the
// dropdown is opened, so it never runs on the render path of every page.
export function NotificationBell({ unread }: { unread: number }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [visibleUnread, setVisibleUnread] = useState(unread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setReady(true), []);
  useEffect(() => setVisibleUnread(unread), [unread]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open || items !== null) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    fetch("/api/notifications/recent", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Notifications failed: ${response.status}`);
        return response.json();
      })
      .then((data) => { if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []); })
      .catch((error: unknown) => {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) setLoadError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, items, requestVersion]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        className={styles.trigger}
        type="button"
        data-open={open}
        aria-label={`Уведомления${visibleUnread ? `: ${visibleUnread} непрочитанных` : ""}`}
        aria-expanded={open}
        data-ready={ready}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {visibleUnread ? <span className={styles.badge}>{formatBadgeCount(visibleUnread)}</span> : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <div className={styles.head}>
            <strong>Уведомления</strong>
            {visibleUnread ? (
              <form action={async () => {
                await markAllNotificationsReadAction();
                setVisibleUnread(0);
                setItems((current) => current?.map((item) => ({ ...item, read: true })) ?? current);
              }}>
                <button type="submit">Прочитать всё</button>
              </form>
            ) : null}
          </div>
          <div className={styles.list}>
            {loading && items === null ? <p className={styles.empty}>Загрузка…</p> : null}
            {loadError && !loading ? (
              <p className={styles.empty}>
                Не удалось загрузить.{" "}
                <button type="button" onClick={() => setRequestVersion((value) => value + 1)}>Повторить</button>
              </p>
            ) : null}
            {(items ?? []).map((item) => (
              <Link
                className={styles.item}
                data-unread={!item.read}
                href={item.href || "/profile"}
                onClick={() => {
                  setOpen(false);
                  if (!item.read) {
                    setVisibleUnread((value) => Math.max(0, value - 1));
                    void markNotificationReadAction(item.id);
                  }
                }}
                key={item.id}
              >
                <span><b>{item.title}</b>{item.occurrenceCount > 1 ? <em className={styles.count}>{occurrenceLabel(item.occurrenceCount)}</em> : null}<time>{item.createdAt}</time></span>
                <p>{item.body}</p>
              </Link>
            ))}
            {items !== null && !items.length && !loading ? <p className={styles.empty}>Новых событий пока нет</p> : null}
          </div>
          <div className={styles.footer}>
            <Link href="/notifications" onClick={() => setOpen(false)}>Все уведомления</Link>
            <Link href="/support" onClick={() => setOpen(false)}>Поддержка</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
