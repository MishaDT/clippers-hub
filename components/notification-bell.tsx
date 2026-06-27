"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/notifications/actions";
import { formatBadgeCount } from "@/components/app-nav";
import styles from "@/components/notification-bell.module.css";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({
  unread,
  items
}: {
  unread: number;
  items: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [visibleUnread, setVisibleUnread] = useState(unread);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setVisibleUnread(unread), [unread]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        className={styles.trigger}
        type="button"
        data-open={open}
        aria-label={`Уведомления${visibleUnread ? `: ${visibleUnread} непрочитанных` : ""}`}
        aria-expanded={open}
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
              }}>
                <button type="submit">Прочитать всё</button>
              </form>
            ) : null}
          </div>
          <div className={styles.list}>
            {items.map((item) => (
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
                <span><b>{item.title}</b><time>{item.createdAt}</time></span>
                <p>{item.body}</p>
              </Link>
            ))}
            {!items.length ? <p className={styles.empty}>Новых событий пока нет</p> : null}
          </div>
          <Link className={styles.support} href="/support" onClick={() => setOpen(false)}>Поддержка ReelPay</Link>
        </div>
      ) : null}
    </div>
  );
}
