"use client";

import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { adminReplySupportAction, sendSupportMessageAction } from "@/app/support/actions";
import styles from "@/app/support/support.module.css";

export function SupportMessageForm({ threadId, admin = false }: { threadId: string; admin?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={styles.composer}
      ref={formRef}
      action={(formData) => {
        setError("");
        startTransition(async () => {
          const result = admin
            ? await adminReplySupportAction(formData)
            : await sendSupportMessageAction(formData);
          if (!result?.ok) {
            setError(result?.error || "Не удалось отправить сообщение");
            return;
          }
          setBody("");
          formRef.current?.reset();
        });
      }}
    >
      <input type="hidden" name="threadId" value={threadId} />
      <textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={admin ? "Ответить от имени ReelPay Support" : "Напишите сообщение"}
        maxLength={1000}
        rows={2}
        required
      />
      <button type="submit" disabled={pending || !body.trim()} aria-label="Отправить">
        <Send size={18} />
        <span>{pending ? "Отправляем" : "Отправить"}</span>
      </button>
      {error ? <p className={styles.formError}>{error}</p> : null}
    </form>
  );
}

