import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, MousePointerClick, ShieldCheck, ShoppingBag, Target } from "lucide-react";
import { AppShell } from "@/components/ui";
import styles from "./results.module.css";

export const metadata: Metadata = {
  title: "Аналитика коротких видео: просмотры, лиды, продажи и ROAS",
  description: "Как ReelPay связывает короткие видео с переходами, лидами и продажами. Понятный отчёт по CPC, CPL, стоимости продажи и ROAS.",
  alternates: { canonical: "/business/results" },
  openGraph: {
    title: "От просмотров коротких видео до продаж — ReelPay",
    description: "Просмотры и переходы считаются автоматически, подтверждённые лиды и продажи добавляются из CRM.",
    url: "/business/results",
    type: "article"
  }
};

const stages = [
  [BarChart3, "Просмотры", "ReelPay получает статистику публикаций через доступные API площадок и сохраняет историю обновлений."],
  [MousePointerClick, "Переходы", "Короткая ссылка кампании считает обезличенные переходы без хранения исходного IP."],
  [Target, "Лиды", "Заказчик добавляет подтверждённые обращения из CRM, промокода или формы заявки."],
  [ShoppingBag, "Продажи", "Количество продаж и выручка превращают медийные показатели в стоимость результата и ROAS."]
] as const;

const metrics = [
  ["CTR", "переходы ÷ просмотры", "Показывает, вызывает ли ролик действие, а не только просмотр."],
  ["CPC", "расход ÷ переходы", "Цена одного посетителя сайта или карточки товара."],
  ["CPL", "расход ÷ лиды", "Цена подтверждённого обращения потенциального клиента."],
  ["CPA", "расход ÷ продажи", "Сколько стоила одна подтверждённая продажа."],
  ["ROAS", "выручка ÷ расход × 100%", "Сколько выручки вернул каждый рубль рекламного бюджета."]
] as const;

const faq = [
  ["ReelPay сам видит продажи?", "Нет. Просмотры и переходы считаются системой, а лиды, продажи и выручку заказчик подтверждает по данным своей CRM, магазина или промокода."],
  ["Зачем считать переходы отдельно от просмотров?", "Большой охват может не давать клиентов. CTR и CPC показывают, какие ролики действительно привели людей к предложению."],
  ["Хранятся ли IP посетителей?", "Исходный IP не сохраняется. Для защиты счётчика используется необратимый технический отпечаток."],
  ["Можно начать с маленького бюджета?", "Да. В ReelPay нет отдельного минимального бюджета платформы: сумма зависит от количества результатов, цели по просмотрам и выбранной ставки."]
] as const;

export default function BusinessResultsPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer }
    }))
  };

  return (
    <AppShell>
      <main className={styles.page}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
        <header className={styles.hero}>
          <span><BadgeCheck size={15} /> Аналитика кампании</span>
          <h1>Просмотры — начало отчёта, а не конечный результат</h1>
          <p>ReelPay связывает публикации с переходами и помогает посчитать стоимость лида, продажи и возврат рекламных расходов. Без выдуманной атрибуции: автоматические и внесённые заказчиком данные отмечены отдельно.</p>
          <div>
            <Link className="btn btn-primary" href="/register?intent=client&returnTo=%2Fcampaigns%2Fnew">Запустить кампанию <ArrowRight size={17} /></Link>
            <Link className="btn" href="/business">Условия для бизнеса</Link>
          </div>
        </header>

        <section className={styles.flow} aria-labelledby="flow-title">
          <div className={styles.sectionHead}>
            <span>Единая воронка</span>
            <h2 id="flow-title">Что попадает в отчёт</h2>
          </div>
          <div className={styles.flowGrid}>
            {stages.map(([Icon, title, text], index) => (
              <article key={title}>
                <i>{index + 1}</i>
                <Icon size={21} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.metricSection} aria-labelledby="metric-title">
          <div className={styles.sectionHead}>
            <span>Без маркетингового тумана</span>
            <h2 id="metric-title">Пять показателей, которые понимает бизнес</h2>
          </div>
          <div className={styles.metricList}>
            {metrics.map(([name, formula, description]) => (
              <article key={name}>
                <b>{name}</b>
                <code>{formula}</code>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.honesty}>
          <ShieldCheck size={24} />
          <div>
            <h2>Честное ограничение</h2>
            <p>ReelPay не называет просмотр продажей и не обещает автоматическую сквозную аналитику без доступа к CRM. Система автоматически фиксирует публикации, просмотры и переходы; коммерческий результат подтверждает заказчик.</p>
          </div>
        </section>

        <section className={styles.faq} aria-labelledby="results-faq-title">
          <div className={styles.sectionHead}><span>Коротко</span><h2 id="results-faq-title">Вопросы об отчёте</h2></div>
          <div>
            {faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
