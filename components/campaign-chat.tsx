"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Mic, RefreshCw, Send } from "lucide-react";
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

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
      onend: (() => void) | null;
    };
  }
}

export function CampaignChat({
  threadId,
  currentUserId,
  peerName,
  messages
}: {
  threadId: string;
  currentUserId: string;
  peerName: string;
  messages: Message[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 12000);
    return () => window.clearInterval(timer);
  }, [router]);

  function startVoiceInput() {
    const Recognition = window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Голосовой ввод не поддерживается этим браузером");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript || "";
      if (textRef.current) textRef.current.value = `${textRef.current.value} ${text}`.trim();
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  return (
    <section className="collab-card chat-card">
      <div className="collab-head">
        <div>
          <span>Чат по заказу</span>
          <h2>{peerName}</h2>
        </div>
        <button className="chat-refresh" type="button" onClick={() => router.refresh()} aria-label="Обновить чат">
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="chat-list">
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <article className={`chat-bubble ${mine ? "mine" : ""}`} key={message.id}>
              <small>{message.type === "VOICE_TRANSCRIPT" ? "Голос в текст" : message.senderName} · {message.createdAt}</small>
              <p>{message.body}</p>
              {message.previews.map((preview) => (
                <a className="safe-preview" href={preview.url} target="_blank" rel="noreferrer" key={preview.url}>
                  <b>{preview.title}</b>
                  <span>{preview.host}</span>
                </a>
              ))}
            </article>
          );
        })}
        {!messages.length ? <p className="muted">Пока сообщений нет. Напиши первое уточнение по заказу.</p> : null}
      </div>

      <form
        ref={formRef}
        className="chat-form"
        action={(formData) => {
          setError("");
          startTransition(async () => {
            const result = await sendChatMessageAction(formData);
            if (!result?.ok) {
              setError(result?.error || "Сообщение не отправлено");
              return;
            }
            formRef.current?.reset();
            router.refresh();
          });
        }}
      >
        <input type="hidden" name="threadId" value={threadId} />
        <input type="hidden" name="messageType" value={listening ? "VOICE_TRANSCRIPT" : "TEXT"} />
        <textarea ref={textRef} name="body" rows={2} placeholder="Напиши сообщение. Ссылки только на ReelPay или видеоплощадки." maxLength={1000} required />
        <div className="chat-actions">
          <button className={`chat-voice ${listening ? "active" : ""}`} type="button" onClick={startVoiceInput}>
            <Mic size={18} /> {listening ? "Слушаю" : "Голосом"}
          </button>
          <button className="btn btn-primary" type="submit" disabled={isPending}>
            <Send size={17} /> {isPending ? "Отправка" : "Отправить"}
          </button>
        </div>
        {error ? <p className="chat-error">{error}</p> : null}
      </form>
    </section>
  );
}
