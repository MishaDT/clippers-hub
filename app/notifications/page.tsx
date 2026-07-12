import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArchiveRestore, Bell, CheckCheck, Search } from "lucide-react";
import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  archiveNotificationAction,
  archiveReadNotificationsAction,
  markAllNotificationsReadAction, markNotificationReadFormAction,
  restoreNotificationAction
} from "./actions";

export const metadata: Metadata = { title: "Уведомления" };

function hrefFor(tab: string, q: string, page?: number) {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("tab", tab);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  return params.size ? `/notifications?${params}` : "/notifications";
}

export default async function NotificationsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = ["unread", "archive"].includes(String(params.tab)) ? String(params.tab) : "all";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const requestedPage = Math.max(1, Number.parseInt(String(params.page || "1"), 10) || 1);
  const pageSize = 20;
  const where = {
    userId: user.id,
    archivedAt: tab === "archive" ? { not: null } : null,
    ...(tab === "unread" ? { readAt: null } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { body: { contains: q, mode: "insensitive" as const } }
      ]
    } : {})
  };
  const total = await prisma.notification.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const items = await prisma.notification.findMany({
    where,
    orderBy: { lastOccurredAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize
  });

  return (
    <AppShell hideFooter>
      <section className="section notifications-page">
        <header className="notifications-head">
          <div><span className="eyebrow"><Bell size={15} /> События</span><h1>Уведомления</h1></div>
          <div className="notifications-bulk">
            <form action={markAllNotificationsReadAction}><button type="submit" aria-label="Прочитать все уведомления" title="Прочитать все"><CheckCheck size={16} /> Прочитать все</button></form>
            <form action={archiveReadNotificationsAction}><button type="submit" aria-label="Скрыть прочитанные уведомления" title="Скрыть прочитанные"><Archive size={16} /> Скрыть прочитанные</button></form>
          </div>
        </header>

        <nav className="notifications-tabs">
          <Link className={tab === "all" ? "active" : ""} href={hrefFor("all", q)}>Все</Link>
          <Link className={tab === "unread" ? "active" : ""} href={hrefFor("unread", q)}>Непрочитанные</Link>
          <Link className={tab === "archive" ? "active" : ""} href={hrefFor("archive", q)}>Архив</Link>
        </nav>

        <form className="notifications-search">
          {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
          <Search size={18} />
          <input name="q" defaultValue={q} placeholder="Найти уведомление" />
        </form>

        <div className="notifications-list">
          {items.map((item) => (
            <article className={`notification-row ${item.readAt ? "" : "unread"}`} key={item.id}>
              <Link className="notification-main" href={item.href || "/profile"}>
                <span><b>{item.title}{item.occurrenceCount > 1 ? ` · ${item.occurrenceCount}` : ""}</b><time>{item.lastOccurredAt.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></span>
                <p>{item.body}</p>
              </Link>
              <span className="notification-actions">
                {!item.readAt && tab !== "archive" ? <form action={markNotificationReadFormAction}>
                  <input type="hidden" name="notificationId" value={item.id} />
                  <button type="submit" aria-label="Отметить прочитанным"><CheckCheck size={17} /></button>
                </form> : null}
                <form action={tab === "archive" ? restoreNotificationAction : archiveNotificationAction}>
                  <input type="hidden" name="notificationId" value={item.id} />
                  <button type="submit" aria-label={tab === "archive" ? "Вернуть из архива" : "В архив"}>
                    {tab === "archive" ? <ArchiveRestore size={17} /> : <Archive size={17} />}
                  </button>
                </form>
              </span>
            </article>
          ))}
          {!items.length ? <div className="notifications-empty"><Bell size={28} /><b>Здесь пока пусто</b></div> : null}
        </div>

        {totalPages > 1 ? <nav className="notifications-pages">
          {page > 1 ? <Link href={hrefFor(tab, q, page - 1)}>Назад</Link> : <span>Назад</span>}
          <b>{page} / {totalPages}</b>
          {page < totalPages ? <Link href={hrefFor(tab, q, page + 1)}>Дальше</Link> : <span>Дальше</span>}
        </nav> : null}
      </section>
    </AppShell>
  );
}
