"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Link2, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendChatMessageAction } from "@/app/actions";

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  type: string;
  createdAt: string;
  previews: Array<{ url: string; host: string; platform: string; title: string }>;
};

type ProgressStep = {
  title: string;
  done: boolean;
  active: boolean;
};

type Progress = {
  statusLabel: string;
  views: string;
  target: string;
  fraudScore: number;
  steps: ProgressStep[];
};

export function CampaignChat({
  threadId,
  currentUserId,
  peerName,
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
  const [progressOpen, setProgressOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [visibleMessages, addOptimisticMessage] = useOptimistic(
    messages,
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

  return (
    <section className="chat-card-v2" id="chat">
      <div className="chat-card-head">
        <div className="chat-peer">
          {peerAvatar ? <img src={peerAvatar} alt="" /> : <span className="chat-peer-fallback">{peerName.slice(0, 2).toUpperCase()}</span>}
          <span>
            <h2>{peerName}</h2>
            <em>{peerHandle || "Участник заказа"}</em>
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
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {campaignTitle && campaignHref ? (
        <Link className="chat-order-link" href={campaignHref} prefetch>
          <span><small>Заказ</small><b>{campaignTitle}</b></span>
          <ArrowUpRight size={18} />
        </Link>
      ) : null}

      {progress ? (
        <div className={`chat-progress-strip ${progressOpen ? "open" : "closed"}`}>
          <button className="chat-progress-toggle" type="button" onClick={() => setProgressOpen((value) => !value)}>
            <span><CheckCircle2 size={16} /> {progress.statusLabel}</span>
            {progressOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {progressOpen ? (
            <>
              <div className="chat-progress-metrics">
                <span><b>{progress.views}</b><em>просмотры</em></span>
                <span><b>{progress.target}</b><em>цель</em></span>
                <span><b>{progress.fraudScore}%</b><em>риск</em></span>
              </div>
              <div className="chat-progress-steps">
                {progress.steps.map((step) => (
                  <span className={step.done ? "done" : step.active ? "active" : ""} key={step.title}>
                    <CheckCircle2 size={15} />
                    {step.title}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="chat-list" ref={listRef} aria-live="polite">
        {visibleMessages.map((message) => {
          const mine = message.senderId === currentUserId;
          const system = message.type === "SYSTEM";
          return (
            <article className={`chat-bubble ${mine ? "mine" : ""} ${system ? "system" : ""}`} key={message.id}>
              {!system ? <small>{message.senderName} · {message.createdAt}</small> : null}
              <p>{message.body}</p>
              {message.previews.map((preview) => (
                <a className="safe-preview" href={preview.url} target="_blank" rel="noreferrer" key={preview.url}>
                  <Link2 size={16} />
                  <span><b>{preview.platform === "LINK" ? "Ссылка ReelPay" : preview.platform}</b><em>{preview.host}</em></span>
                  <ArrowUpRight size={16} />
                </a>
              ))}
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
    </section>
  );
}
