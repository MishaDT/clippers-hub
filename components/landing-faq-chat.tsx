import Link from "next/link";
import { Sparkles } from "lucide-react";
import styles from "./landing-faq-chat.module.css";

const faq: { q: string; a: string; href?: string; hrefLabel?: string }[] = [
  {
    q: "Как проверяются просмотры?",
    a: "Где доступно, ReelPay получает статистику через подключённый аккаунт площадки. Дополнительно проверяются владелец публикации, повторные ссылки и подозрительная динамика. Неоднозначный результат отправляется модератору.",
    href: "/safety/views",
    hrefLabel: "Методика проверки"
  },
  {
    q: "Что делать, если я не согласен с решением?",
    a: "До выплаты решение можно оспорить. Поддержка увидит бриф, черновик, историю проверок и данные публикации, поэтому спор рассматривается по сохранённым фактам."
  },
  {
    q: "Когда клиппер получает выплату?",
    a: "После достижения условия результата начисление проходит защитное окно до 48 часов. Затем подтверждённая сумма становится доступной к выводу."
  },
  {
    q: "Сколько платит заказчик?",
    a: "Заказчик сам задаёт число публикаций, цель и ставку. Максимальная сумма резервируется перед стартом, а неиспользованный свободный остаток остаётся на балансе."
  },
  {
    q: "Какие площадки можно использовать?",
    a: "YouTube Shorts, VK Клипы, TikTok и Instagram. Способ проверки зависит от доступности официального API: автоматически через подключённый аккаунт либо с дополнительной модерацией."
  }
];

export function LandingFaqChat() {
  return (
    <section className={styles.section} aria-labelledby="faq-title">
      <div className={styles.head}>
        <span className={styles.badge}><Sparkles size={14} /> Коротко о главном</span>
        <h2 id="faq-title">Что важно знать до старта</h2>
      </div>

      <div className={styles.chat}>
        {faq.map(({ q, a, href, hrefLabel }) => (
          <details className={styles.item} key={q}>
            <summary className={styles.question}>{q}</summary>
            <div className={styles.answer}>
              <span className={styles.avatar}><Sparkles size={14} /></span>
              <div className={styles.bubble}>
                <p>{a}</p>
                {href ? <Link href={href}>{hrefLabel} →</Link> : null}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
