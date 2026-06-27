import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/ui";
import styles from "../info.module.css";

export const metadata: Metadata = {
  title: "Помощь — ReelPay",
  description: "Короткие ответы о заказах, роликах и выплатах в ReelPay."
};

const questions = [
  ["Как взять заказ?", "Откройте раздел заказов, выберите подходящее задание и нажмите «Откликнуться». Рабочий чат появится после принятия отклика."],
  ["Как отправить ролик?", "Откройте активную работу, загрузите файл или добавьте ссылку на опубликованный ролик и отправьте его на проверку."],
  ["Когда начисляется оплата?", "После выполнения условий заказа и проверки просмотров. Сумма на проверке отображается отдельно от доступного баланса."],
  ["Как создать кампанию?", "Переключитесь в режим заказчика, откройте «Создать» и заполните задачу, источник, бюджет и срок."],
  ["Где изменить способ входа?", "В профиле откройте «Настройки». Там можно подключить или отключить вход через социальные сети."]
] as const;

export default function HelpPage() {
  return (
    <AppShell>
      <article className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Помощь</span>
          <h1>Ответы без сложных инструкций</h1>
          <p>Основные действия занимают несколько шагов. Ниже — ответы на частые вопросы.</p>
        </header>

        <section className={styles.faq}>
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </section>

        <section className={styles.section}>
          <h2>Не нашли ответ?</h2>
          <p>Создайте обращение. Поддержка увидит ваш вопрос и ответит в сервисе.</p>
          <Link className="btn btn-primary" href="/support">Написать в поддержку</Link>
        </section>
      </article>
    </AppShell>
  );
}
