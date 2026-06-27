import Link from "next/link";
import type { Prisma, SupportPriority, SupportStatus } from "@prisma/client";
import { Headphones, Inbox } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { SupportMessageForm } from "@/components/support-message-form";
import { SupportReadMarker } from "@/components/support-read-marker";
import { updateSupportThreadAction } from "@/app/support/actions";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import {
  supportCategories,
  supportCategoryLabels,
  supportPriorities,
  supportPriorityLabels,
  supportStatuses,
  supportStatusLabels
} from "@/lib/support";
import styles from "@/app/support/support.module.css";

export const dynamic = "force-dynamic";
const pageSize = 30;

function dateLabel(date: Date) {
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function hrefWith(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value && value !== "ALL" && value !== 1) params.set(key, String(value));
  const query = params.toString();
  return query ? `/admin/support?${query}` : "/admin/support";
}

export default async function AdminSupportPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status = supportStatuses.includes(params.status as SupportStatus) ? params.status as SupportStatus : "ALL";
  const category = supportCategories.includes(params.category as never) ? String(params.category) : "ALL";
  const requestedId = typeof params.thread === "string" ? params.thread : "";
  const page = Math.max(1, Number.parseInt(String(params.page || "1"), 10) || 1);
  const configuredEmails = String(process.env.ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);

  const where: Prisma.SupportThreadWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(category !== "ALL" ? { category: category as Prisma.EnumSupportCategoryFilter["equals"] } : {}),
    ...(q ? {
      OR: [
        { subject: { contains: q, mode: "insensitive" } },
        { requester: { name: { contains: q, mode: "insensitive" } } },
        { requester: { email: { contains: q, mode: "insensitive" } } }
      ]
    } : {})
  };

  const [total, threads, selected, admins] = await Promise.all([
    prisma.supportThread.count({ where }),
    prisma.supportThread.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, subject: true, status: true, priority: true, category: true, updatedAt: true,
        requester: { select: { name: true, email: true } },
        assignedTo: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } }
      }
    }),
    requestedId
      ? prisma.supportThread.findUnique({
          where: { id: requestedId },
          include: {
            requester: { select: { name: true, email: true, handle: true } },
            assignedTo: { select: { id: true, name: true } },
            messages: {
              include: { sender: { select: { id: true, name: true, role: true, email: true } } },
              orderBy: { createdAt: "asc" },
              take: 150
            }
          }
        })
      : Promise.resolve(null),
    prisma.user.findMany({
      where: { OR: [{ role: "ADMIN" }, ...(configuredEmails.length ? [{ email: { in: configuredEmails } }] : [])] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true }
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminShell>
      <div className={styles.adminPage}>
        <AdminPageHeader
          eyebrow="Поддержка"
          title="Обращения"
          description="Новые обращения сверху. Откройте строку, назначьте ответственного и ответьте от имени ReelPay Support."
        />

        <form className={styles.filters} action="/admin/support">
          <input name="q" defaultValue={q} placeholder="Тема, имя или email" />
          <select name="status" defaultValue={status}>
            <option value="ALL">Все статусы</option>
            {supportStatuses.map((value) => <option value={value} key={value}>{supportStatusLabels[value]}</option>)}
          </select>
          <select name="category" defaultValue={category}>
            <option value="ALL">Все категории</option>
            {supportCategories.map((value) => <option value={value} key={value}>{supportCategoryLabels[value]}</option>)}
          </select>
          <button type="submit">Найти</button>
        </form>

        <div className={styles.layout} data-selected={Boolean(selected)}>
          <aside className={styles.sidebar}>
            <div className={styles.threadList}>
              {threads.map((thread) => (
                <Link
                  className={styles.thread}
                  data-active={thread.id === requestedId}
                  href={hrefWith({ thread: thread.id, q, status, category, page })}
                  key={thread.id}
                >
                  <span><b>{thread.subject}</b><i className={styles.status}>{supportStatusLabels[thread.status]}</i></span>
                  <small>{thread.requester.name} · {supportPriorityLabels[thread.priority]} · {dateLabel(thread.updatedAt)}</small>
                  <small>{thread.messages[0]?.body.slice(0, 75) || "Нет сообщений"}</small>
                </Link>
              ))}
              {!threads.length ? <div className={styles.empty}><Inbox size={28} /><p>По фильтру обращений нет.</p></div> : null}
            </div>
          </aside>

          <main className={styles.conversation}>
            {selected ? (
              <>
                <SupportReadMarker threadId={selected.id} admin />
                <div className={styles.conversationHead}>
                  <div>
                    <span className={styles.eyebrow}>{supportCategoryLabels[selected.category]} · {selected.requester.email}</span>
                    <h2>{selected.subject}</h2>
                  </div>
                  <div className={styles.supportIdentity}><i>R</i><span>ReelPay Support</span></div>
                </div>
                <form className={styles.controlForm} action={updateSupportThreadAction}>
                  <input type="hidden" name="threadId" value={selected.id} />
                  <label>Статус
                    <select name="status" defaultValue={selected.status}>
                      {supportStatuses.map((value) => <option value={value} key={value}>{supportStatusLabels[value]}</option>)}
                    </select>
                  </label>
                  <label>Приоритет
                    <select name="priority" defaultValue={selected.priority}>
                      {supportPriorities.map((value) => <option value={value} key={value}>{supportPriorityLabels[value]}</option>)}
                    </select>
                  </label>
                  <label>Ответственный
                    <select name="assignedToId" defaultValue={selected.assignedToId || ""}>
                      <option value="">Назначить себя</option>
                      {admins.map((admin) => <option value={admin.id} key={admin.id}>{admin.name} · {admin.email}</option>)}
                    </select>
                  </label>
                  <button type="submit">Сохранить</button>
                </form>
                <div className={styles.messages}>
                  {selected.messages.map((message) => {
                    const fromRequester = message.senderId === selected.requesterId;
                    const meta = parseJson<{ urls?: string[] }>(message.metadataJson, {});
                    const previews = (meta.urls || []).map(buildSafePreview).filter(Boolean);
                    return (
                      <article className={styles.message} data-mine={!fromRequester} key={message.id}>
                        <small>{fromRequester ? selected.requester.name : "ReelPay Support"} · {dateLabel(message.createdAt)}</small>
                        <p>{message.body}</p>
                        {previews.length ? <div className={styles.links}>{previews.map((preview) => preview ? <a href={preview.url} target="_blank" rel="noreferrer" key={preview.url}>{preview.host}</a> : null)}</div> : null}
                      </article>
                    );
                  })}
                </div>
                <SupportMessageForm threadId={selected.id} admin />
              </>
            ) : (
              <div className={styles.empty}><Headphones size={34} /><h2>Очередь поддержки</h2><p>Выберите обращение слева.</p></div>
            )}
          </main>
        </div>

        {totalPages > 1 ? (
          <nav className={styles.pagination}>
            <Link href={hrefWith({ q, status, category, page: Math.max(1, page - 1) })}>Назад</Link>
            <span>{page} / {totalPages}</span>
            <Link href={hrefWith({ q, status, category, page: Math.min(totalPages, page + 1) })}>Дальше</Link>
          </nav>
        ) : null}
      </div>
    </AdminShell>
  );
}

