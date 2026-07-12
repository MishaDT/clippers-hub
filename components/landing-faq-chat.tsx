import Link from "next/link";
import { Sparkles } from "lucide-react";
import styles from "./landing-faq-chat.module.css";

const clientFaq: { q: string; a: string; href?: string; hrefLabel?: string }[] = [
  {
    q: "Как проверяются просмотры?",
    a: "ReelPay сверяет владельца публикации и статистику площадки. Сомнительный результат уходит на ручную проверку.",
    href: "/safety/views",
    hrefLabel: "Методика проверки"
  },
  {
    q: "Можно проверить ролик до публикации?",
    a: "Да. Если в кампании включено согласование, сначала вы получаете черновик и можете запросить правки."
  },
  {
    q: "Сколько платит заказчик?",
    a: "Вы задаёте лимит заранее. Списывается только подтверждённый результат, свободный остаток сохраняется на балансе."
  },
  {
    q: "Что делать, если я не согласен с проверкой?",
    a: "Подайте апелляцию до выплаты. Поддержка проверит бриф, черновик, ссылку и сохранённую статистику."
  }
];

const workerFaq: typeof clientFaq = [
  {
    q: "Что я вижу до принятия заказа?",
    a: "Задачу, исходник, площадку, срок и сумму к выплате."
  },
  {
    q: "Нужно ли много подписчиков?",
    a: "Общего порога нет. Если у заказа есть требования к аккаунту, вы увидите их заранее."
  },
  {
    q: "Как подтвердить, что ролик мой?",
    a: "Выберите подключённый аккаунт или добавьте код ReelPay. Подходящий способ будет указан при сдаче.",
    href: "/settings/account#social-accounts",
    hrefLabel: "Подключить площадку"
  },
  {
    q: "Когда я получу выплату?",
    a: "После проверки результата действует защитное окно до 48 часов. Затем деньги становятся доступны к выводу. Если решение спорное, его можно обжаловать."
  }
];

export function LandingFaqChat({ audience = "client" }: { audience?: "client" | "worker" }) {
  const faq = audience === "worker" ? workerFaq : clientFaq;
  return (
    <section className={styles.section} aria-labelledby="faq-title">
      <div className={styles.head}>
        <span className={styles.badge}><Sparkles size={14} /> Коротко о главном</span>
        <h2 id="faq-title">{audience === "worker" ? "Что важно знать клипперу" : "Что важно знать заказчику"}</h2>
      </div>

      <div className={styles.chat}>
        {faq.map(({ q, a, href, hrefLabel }) => (
          <details className={styles.item} key={q} open>
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
