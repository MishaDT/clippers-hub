import Link from "next/link";
import { Headphones, MessageCircle, Plus } from "lucide-react";
import { createSupportThreadAction } from "@/app/support/actions";
import { AppShell } from "@/components/ui";
import { SupportMessageForm } from "@/components/support-message-form";
import { SupportReadMarker } from "@/components/support-read-marker";
import { requireUser } from "@/lib/auth";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { supportCategories, supportCategoryLabels, supportStatusLabels } from "@/lib/support";
import styles from "@/app/support/support.module.css";

export const dynamic = "force-dynamic";

function dateLabel(date: Date) {
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function SupportPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const requestedId = typeof params.thread === "string" ? params.thread : "";
  const showNew = params.new === "1";

  const [threads, selected] = await Promise.all([
    prisma.supportThread.findMany({
      where: { requesterId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true, subject: true, status: true, updatedAt: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } }
      }
    }),
    requestedId
      ? prisma.supportThread.findFirst({
          where: { id: requestedId, requesterId: user.id },
          include: {
            messages: {
              include: { sender: { select: { id: true, name: true, role: true, email: true } } },
              orderBy: { createdAt: "asc" },
              take: 100
            }
          }
        })
      : Promise.resolve(null)
  ]);

  return (
    <AppShell>
      <section className={styles.page}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>Помощь</span>
            <h1>Поддержка</h1>
            <p>Опишите проблему. Ответ и весь статус обращения останутся здесь.</p>
          </div>
        </div>

        <div className={styles.layout} data-selected={Boolean(selected)}>
          <aside className={styles.sidebar}>
            {showNew ? (
              <form className={styles.createForm} action={createSupportThreadAction}>
                <label>Тема<input name="subject" minLength={5} maxLength={120} required placeholder="Например: не прошла выплата" /></label>
                <label>Категория
                  <select name="category" defaultValue="OTHER">
                    {supportCategories.map((category) => <option value={category} key={category}>{supportCategoryLabels[category]}</option>)}
                  </select>
                </label>
                <label>Что случилось<textarea name="body" rows={5} maxLength={1000} required placeholder="Коротко опишите ситуацию и ожидаемый результат" /></label>
                <button className={styles.primaryButton} type="submit">Создать обращение</button>
                {params.error ? <p className={styles.error}>Проверьте тему, текст и ссылки.</p> : null}
              </form>
            ) : (
              <Link className={styles.newToggle} href="/support?new=1"><Plus size={17} /> Новое обращение</Link>
            )}

            <div className={styles.threadList}>
              {threads.map((thread) => (
                <Link className={styles.thread} data-active={thread.id === requestedId} href={`/support?thread=${thread.id}`} key={thread.id}>
                  <span><b>{thread.subject}</b><i className={styles.status}>{supportStatusLabels[thread.status]}</i></span>
                  <small>{thread.messages[0]?.body.slice(0, 70) || "Без сообщений"} · {dateLabel(thread.updatedAt)}</small>
                </Link>
              ))}
              {!threads.length && !showNew ? <p className={styles.muted}>Обращений пока нет.</p> : null}
            </div>
          </aside>

          <main className={styles.conversation}>
            {selected ? (
              <>
                <SupportReadMarker threadId={selected.id} />
                <div className={styles.conversationHead}>
                  <div><span className={styles.eyebrow}>{supportCategoryLabels[selected.category]}</span><h2>{selected.subject}</h2></div>
                  <div className={styles.supportIdentity}><i>R</i><span>ReelPay Support</span></div>
                </div>
                <div className={styles.messages}>
                  {selected.messages.map((message) => {
                    const adminMessage = message.sender.role === "ADMIN" || message.sender.email === process.env.SUPPORT_EMAIL;
                    const meta = parseJson<{ urls?: string[] }>(message.metadataJson, {});
                    const previews = (meta.urls || []).map(buildSafePreview).filter(Boolean);
                    return (
                      <article className={styles.message} data-mine={!adminMessage} key={message.id}>
                        <small>{adminMessage ? "ReelPay Support" : "Вы"} · {dateLabel(message.createdAt)}</small>
                        <p>{message.body}</p>
                        {previews.length ? <div className={styles.links}>{previews.map((preview) => preview ? <a href={preview.url} target="_blank" rel="noreferrer" key={preview.url}>{preview.host}</a> : null)}</div> : null}
                      </article>
                    );
                  })}
                </div>
                {!["RESOLVED", "CLOSED"].includes(selected.status) ? <SupportMessageForm threadId={selected.id} /> : <p className={styles.empty}>Обращение закрыто. При необходимости создайте новое.</p>}
              </>
            ) : (
              <div className={styles.empty}><Headphones size={34} /><h2>ReelPay Support</h2><p>Выберите обращение или создайте новое.</p></div>
            )}
          </main>
        </div>
      </section>
    </AppShell>
  );
}

