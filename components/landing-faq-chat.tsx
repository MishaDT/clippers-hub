import Link from "next/link";
import { Sparkles } from "lucide-react";
import styles from "./landing-faq-chat.module.css";

const faq: { q: string; a: string; href?: string; hrefLabel?: string }[] = [
  {
    q: "Как вы проверяете накрутку?",
    a: "Просмотры берём из официальных API площадок, проверяем владение публикацией и анализируем скорость набора. Подозрительные ролики уходят на ручную проверку. Подробно — на странице «Как мы считаем просмотры».",
    href: "/safety/views",
    hrefLabel: "Методика подсчёта"
  },
  {
    q: "Что если модерация ошиблась и одобрила лишнее?",
    a: "Если спор решён в вашу пользу из-за ошибки платформы — возврат идёт за наш счёт, а выплата клипперу сохраняется. Вы не платите за чужую ошибку."
  },
  {
    q: "Что если мой клип отклонили несправедливо?",
    a: "Любую работу до выплаты можно оспорить. Спор видят обе стороны и администратор, решение принимается по сохранённой истории проверок."
  },
  {
    q: "Когда я получу деньги?",
    a: "После достижения цели начисление проходит защитное окно 48 часов, затем становится доступным к выводу. Так мы успеваем перепроверить накрутку."
  },
  {
    q: "Сколько это стоит для заказчика?",
    a: "Вы задаёте бюджет и ставку за 1000 просмотров. Деньги замораживаются в эскроу и списываются только за подтверждённый результат, неизрасходованный остаток возвращается."
  },
  {
    q: "Какие площадки поддерживаются?",
    a: "VK Клипы, YouTube Shorts и TikTok — с автоматической проверкой. Instagram* — с ручной модерацией (*принадлежит Meta, признанной в РФ экстремистской)."
  }
];

export function LandingFaqChat() {
  return (
    <section className={styles.section} aria-labelledby="faq-title">
      <div className={styles.head}>
        <span className={styles.badge}><Sparkles size={14} /> Частые вопросы</span>
        <h2 id="faq-title">Отвечаем на главные сомнения</h2>
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
