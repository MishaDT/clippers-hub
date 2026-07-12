"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, BadgeCheck, ChevronDown, LoaderCircle } from "lucide-react";
import styles from "./pilot-lead-form.module.css";

export function PilotLeadForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  function currentUtm() {
    const query = new URLSearchParams(window.location.search);
    return {
      utmSource: query.get("utm_source") || "",
      utmMedium: query.get("utm_medium") || "",
      utmCampaign: query.get("utm_campaign") || ""
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        contact: form.get("contact"),
        contentUrl: form.get("contentUrl"),
        budgetRub: Number(form.get("budgetRub")),
        goal: form.get("goal"),
        website: form.get("website"),
        consent: form.get("consent") === "on",
        ...currentUtm()
      })
    });
    const result = await response.json().catch(() => ({ ok: false, error: "Не удалось отправить заявку." }));
    if (!response.ok || !result.ok) {
      setState("error");
      setMessage(result.error || "Не удалось отправить заявку.");
      return;
    }
    event.currentTarget.reset();
    setState("done");
  }

  return (
    <section className={styles.section} id="pilot" aria-labelledby="pilot-title">
      <div className={styles.copy}>
        <span><BadgeCheck size={16} /> Пилот ReelPay</span>
        <h2 id="pilot-title">Запустим первые ролики вместе</h2>
        <p>Подходит экспертам, подкастам, онлайн-школам и личным брендам с готовым длинным контентом.</p>
        <ul>
          <li>Бюджет от 15 000 ₽, без подписки</li>
          <li>Согласование черновика до публикации</li>
          <li>Отчёт и возврат неиспользованного остатка</li>
        </ul>
      </div>
      <div className={styles.formColumn}>
        <button className={styles.formToggle} type="button" aria-expanded={formOpen} onClick={() => setFormOpen((value) => !value)}>
          <span><b>Оставить заявку</b><small>5 полей · около 2 минут</small></span>
          <ChevronDown size={19} />
        </button>
        <div className={styles.formPanel} data-open={formOpen || state === "done"}>
          {state === "done" ? (
            <div className={styles.success} role="status">
              <BadgeCheck size={30} />
              <h3>Заявка получена</h3>
              <p>Мы свяжемся с вами, уточним контент и поможем собрать первый пилот.</p>
            </div>
          ) : (
            <form className={styles.form} onSubmit={submit}>
              <label>Как к вам обращаться<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
              <label>Телефон, email или Telegram<input name="contact" required maxLength={120} autoComplete="email" /></label>
              <label>Ссылка на исходный контент<input name="contentUrl" type="url" placeholder="https://youtube.com/..." maxLength={500} /></label>
              <label>Планируемый бюджет, ₽<input name="budgetRub" type="number" min={15000} max={10000000} step={1000} defaultValue={15000} required /></label>
              <label className={styles.wide}>Что хотите получить<textarea name="goal" rows={3} maxLength={500} placeholder="Например: 5 Shorts из выпусков подкаста" required /></label>
              <input className={styles.trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <label className={`${styles.consent} ${styles.wide}`}><input name="consent" type="checkbox" required /><span>Согласен на обработку контактных данных для ответа на заявку.</span></label>
              {state === "error" ? <p className={`${styles.error} ${styles.wide}`} role="alert">{message}</p> : null}
              <button className={styles.wide} type="submit" disabled={state === "sending"}>
                {state === "sending" ? <LoaderCircle className={styles.spin} size={18} /> : null}
                {state === "sending" ? "Отправляем" : "Запустить пилот"} <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
