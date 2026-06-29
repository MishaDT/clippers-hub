"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ArrowUpRight, Ban, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Link2, Pencil, RefreshCw, Send, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { advanceCollabStageAction, deleteChatMessageAction, editChatMessageAction, sendChatMessageAction } from "@/app/actions";

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  type: string;
  createdAt: string;
  deleted?: boolean;
  edited?: boolean;
  previews: Array<{ url: string; host: string; platform: string; title: string }>;
};

type ProgressStep = {
  title: string;
  done: boolean;
  active: boolean;
};

type Progress = {
  kind?: "campaign" | "collab";
  statusLabel: string;
  views: string;
  target: string;
  fraudScore: number;
  steps: ProgressStep[];
  canAdvance?: boolean;
};

function compactSystemMessages(messages: Message[]) {
  return messages.filter((message, index) => {
    const previous = messages[index - 1];
    return !(message.type === "SYSTEM" && previous?.type === "SYSTEM" && previous.body === message.body);
  });
}

export function CampaignChat({
  threadId,
  currentUserId,
  peerName,
  peerRole,
  peerHandle,
  peerAvatar,
  campaignTitle,
  campaignHref,
  messages,
  progress
}: {
  threadId: string;
  currentUserId: string;
  peerName: string;
  peerRole?: "Заказчик" | "Исполнитель";
  peerHandle?: string;
  peerAvatar?: string;
  campaignTitle?: string;
  campaignHref?: string;
  messages: Message[];
  progress?: Progress;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [progressOpen, setProgressOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warnUrl, setWarnUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editError, setEditError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();

  const startEdit = (message: Message) => {
    setEditingId(message.id);
    setEditBody(message.body);
    setEditError("");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditBody("");
    setEditError("");
  };
  const saveEdit = (id: string) => {
    const value = editBody.trim();
    if (!value) { setEditError("Сообщение не может быть пустым"); return; }
    startActionTransition(async () => {
      const data = new FormData();
      data.set("messageId", id);
      data.set("body", value);
      const result = await editChatMessageAction(data);
      if (!result?.ok) { setEditError(result?.error || "Не удалось изменить"); return; }
      cancelEdit();
      router.refresh();
    });
  };
  const removeMessage = (id: string) => {
    if (!window.confirm("Удалить сообщение? Оно исчезнет у обоих участников.")) return;
    startActionTransition(async () => {
      const data = new FormData();
      data.set("messageId", id);
      const result = await deleteChatMessageAction(data);
      if (result?.ok) router.refresh();
    });
  };
  const [visibleMessages, addOptimisticMessage] = useOptimistic(
    compactSystemMessages(messages),
    (current, next: Message) => [...current, next]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: visibleMessages.length > 1 ? "smooth" : "auto" });
  }, [visibleMessages.length]);

  useEffect(() => {
    const textarea = textRef.current;
    if (!textarea) return;
    textarea.style.height = "40px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, [body]);

  return (
    <section className="chat-card-v2" id="chat">
      <div className="chat-card-head">
        <div className="chat-peer">
          {peerAvatar ? <img src={peerAvatar} alt="" /> : <span className="chat-peer-fallback">{peerName.slice(0, 2).toUpperCase()}</span>}
          <span>
            <h2>{peerName}</h2>
            <em>{peerRole ? `${peerRole} · ${peerHandle || ""}` : peerHandle || "Участник заказа"}</em>
          </span>
        </div>
        <button
          className={`chat-icon-btn ${refreshing ? "refreshing" : ""}`}
          type="button"
          onClick={() => {
            setRefreshing(true);
            router.refresh();
            window.setTimeout(() => setRefreshing(false), 700);
          }}
          aria-label="Обновить чат"
          title="Обновить чат"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {campaignTitle && campaignHref ? (
        <Link className="chat-order-link" href={campaignHref} prefetch>
          <span><small>Заказ</small><b>{campaignTitle}</b></span>
          <strong className="chat-order-action">Открыть заказ <ArrowUpRight size={17} /></strong>
        </Link>
      ) : null}

      {progress ? (
        <div className={`chat-progress-strip ${progressOpen ? "open" : "closed"} ${progress.kind === "collab" ? "is-collab" : ""}`}>
          <button className="chat-progress-toggle" type="button" onClick={() => setProgressOpen((value) => !value)}>
            <span><CheckCircle2 size={16} /> {progress.statusLabel}</span>
            {progressOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {progressOpen ? (
            <>
              {progress.kind !== "collab" ? (
                <div className="chat-progress-metrics">
                  <span><b>{progress.views}</b><em>просмотры</em></span>
                  <span><b>{progress.target}</b><em>цель</em></span>
                  <span><b>{progress.fraudScore}%</b><em>риск</em></span>
                </div>
              ) : null}
              <div className="chat-progress-steps">
                {progress.steps.map((step) => (
                  <span className={step.done ? "done" : step.active ? "active" : ""} key={step.title}>
                    <CheckCircle2 size={15} />
                    {step.title}
                  </span>
                ))}
              </div>
              {progress.kind === "collab" && progress.canAdvance ? (
                <button
                  className="chat-collab-next"
                  type="button"
                  disabled={actionPending}
                  onClick={() => {
                    startActionTransition(async () => {
                      const data = new FormData();
                      data.set("threadId", threadId);
                      const result = await advanceCollabStageAction(data);
                      if (!result?.ok) {
                        setError(result?.error || "Не удалось обновить этап");
                        return;
                      }
                      router.refresh();
                    });
                  }}
                >
                  <CheckCircle2 size={15} />
                  {actionPending ? "Обновляем…" : "Договорились — начать выполнение"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <div
        className="chat-list"
        ref={listRef}
        aria-live="polite"
        onClick={(event) => {
          const anchor = (event.target as HTMLElement).closest("a.safe-preview") as HTMLAnchorElement | null;
          if (!anchor) return;
          try {
            if (new URL(anchor.href).host === window.location.host) return; // internal ReelPay link — safe
          } catch { /* unparsable — warn anyway */ }
          event.preventDefault();
          setWarnUrl(anchor.href);
        }}
      >
        {visibleMessages.map((message) => {
          const mine = message.senderId === currentUserId;
          const system = message.type === "SYSTEM";
          const editing = editingId === message.id;
          const canManage = mine && !system && !message.deleted && !message.id.startsWith("pending-");
          return (
            <article className={`chat-bubble ${mine ? "mine" : ""} ${system ? "system" : ""} ${message.deleted ? "deleted" : ""}`} key={message.id}>
              {!system && !message.deleted ? (
                <small>{message.senderName} · {message.createdAt}{message.edited ? " · изменено" : ""}</small>
              ) : null}
              {message.deleted ? (
                <p className="chat-deleted-text"><Ban size={14} /> Сообщение удалено</p>
              ) : editing ? (
                <div className="chat-edit">
                  <textarea
                    value={editBody}
                    rows={2}
                    maxLength={1000}
                    onChange={(event) => setEditBody(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelEdit();
                      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); saveEdit(message.id); }
                    }}
                  />
                  <div className="chat-edit-actions">
                    <button type="button" className="chat-edit-cancel" onClick={cancelEdit}>Отмена</button>
                    <button type="button" className="chat-edit-save" onClick={() => saveEdit(message.id)} disabled={actionPending}>Сохранить</button>
                  </div>
                  {editError ? <span className="chat-edit-err">{editError}</span> : null}
                </div>
              ) : (
                <>
                  <p>{message.body}</p>
                  {message.previews.map((preview) => (
                    <a className="safe-preview" href={preview.url} target="_blank" rel="noreferrer" key={preview.url}>
                      <Link2 size={16} />
                      <span><b>{preview.platform === "LINK" ? "Ссылка ReelPay" : preview.platform}</b><em>{preview.host}</em></span>
                      <ArrowUpRight size={16} />
                    </a>
                  ))}
                </>
              )}
              {canManage && !editing ? (
                <div className="chat-msg-actions">
                  <button type="button" aria-label="Изменить сообщение" onClick={() => startEdit(message)}><Pencil size={13} /></button>
                  <button type="button" aria-label="Удалить сообщение" onClick={() => removeMessage(message.id)} disabled={actionPending}><Trash2 size={13} /></button>
                </div>
              ) : null}
            </article>
          );
        })}
        {!visibleMessages.length ? <p className="muted">Сообщений пока нет. Напиши уточнение по ролику или заказу.</p> : null}
      </div>

      <form
        ref={formRef}
        className="chat-form"
        action={(formData) => {
          setError("");
          startTransition(async () => {
            const optimisticBody = String(formData.get("body") || "").trim();
            addOptimisticMessage({
              id: `pending-${Date.now()}`,
              senderId: currentUserId,
              senderName: "Вы",
              body: optimisticBody,
              type: "TEXT",
              createdAt: "сейчас",
              previews: []
            });
            const result = await sendChatMessageAction(formData);
            if (!result?.ok) {
              setError(result?.error || "Сообщение не отправлено");
              return;
            }
            formRef.current?.reset();
            setBody("");
          });
        }}
      >
        <input type="hidden" name="threadId" value={threadId} />
        <textarea
          ref={textRef}
          name="body"
          rows={1}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (body.trim() && !isPending) formRef.current?.requestSubmit();
            }
          }}
          placeholder="Напишите сообщение"
          maxLength={1000}
          required
        />
        <div className="chat-actions">
          <button className="chat-send" type="submit" disabled={isPending || !body.trim()} aria-label="Отправить сообщение">
            {isPending ? <RefreshCw className="spin" size={19} /> : <Send size={19} />}
          </button>
        </div>
        {error ? <p className="chat-error">{error}</p> : null}
      </form>

      {warnUrl ? (
        <div className="link-warning" role="dialog" aria-modal="true" onClick={() => setWarnUrl(null)}>
          <div className="link-warning-card" onClick={(event) => event.stopPropagation()}>
            <span className="link-warning-ico"><ShieldAlert size={26} /></span>
            <h3>Переход на внешний сайт</h3>
            <p>Эта ссылка ведёт за пределы ReelPay. Мы не проверяли, что на той стороне — не вводите пароли и платёжные данные. Если не уверены в отправителе, лучше не переходить.</p>
            <span className="link-warning-url">{warnUrl}</span>
            <div className="link-warning-actions">
              <button type="button" className="lw-cancel" onClick={() => setWarnUrl(null)}>Остаться</button>
              <a
                className="lw-go"
                href={warnUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={() => setWarnUrl(null)}
              >
                Всё равно перейти <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
