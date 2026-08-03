import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, BookOpenCheck, BriefcaseBusiness, ShieldCheck, Video } from "lucide-react";
import { AppShell } from "@/components/ui";
import styles from "./academy.module.css";

export const metadata: Metadata = {
  title: "Академия коротких видео для бизнеса и клипперов",
  description: "Практические маршруты ReelPay: как запустить кампанию, выполнить заказ, проверить публикацию, защитить бюджет и посчитать результат.",
  alternates: { canonical: "/academy" },
  openGraph: {
    title: "Академия ReelPay — от брифа до проверенного результата",
    description: "Короткие инструкции для бизнеса и клипперов без лишней теории.",
    url: "/academy",
    type: "website"
  }
};

const clientSteps = [
  ["Сформулируйте один результат", "Укажите формат, площадки, срок, цель по просмотрам и ставку. Чем короче проверяемый бриф, тем меньше правок."],
  ["Зарезервируйте бюджет", "ReelPay помещает сумму кампании в эскроу. Клиппер видит доступную выплату до начала работы."],
  ["Проверьте черновик", "Согласуйте содержание до публикации. Количество кругов правок фиксируется в заказе."],
  ["Смотрите не только просмотры", "Добавьте ссылку с подсчётом переходов и подтвердите лиды, продажи и выручку из своей CRM."]
] as const;

const workerSteps = [
  ["Подключите свой аккаунт", "Привяжите площадку в настройках аккаунта. Если OAuth площадки недоступен, ReelPay покажет честный ручной способ подтверждения."],
  ["Выберите понятный заказ", "До отклика проверьте исходник, дедлайн, требования, свободные места и максимальную чистую выплату."],
  ["Сначала отправьте черновик", "Не публикуйте ролик до согласования, если заказ требует предварительной проверки."],
  ["Публикуйте с нужной маркировкой", "Используйте согласованный аккаунт, ссылку и рекламную маркировку. После проверки результат появится в отчёте."]
] as const;

const rules = [
  [BadgeCheck, "Подтверждайте владение", "Публикация должна быть размещена на вашем подключённом аккаунте."],
  [ShieldCheck, "Не накручивайте показатели", "Резкие аномалии, слабая вовлечённость и несоответствие данных отправляют результат на ручную проверку."],
  [BarChart3, "Отделяйте охват от продаж", "Просмотры измеряют распространение. Переходы, лиды и продажи показывают коммерческий эффект."],
  [BookOpenCheck, "Сохраняйте договорённости", "Бриф, черновики, статусы, проверки и спор остаются внутри рабочего пространства ReelPay."]
] as const;

function Route({ steps }: { steps: readonly (readonly [string, string])[] }) {
  return (
    <ol className={styles.route}>
      {steps.map(([title, text], index) => (
        <li key={title}>
          <span>{index + 1}</span>
          <div><h3>{title}</h3><p>{text}</p></div>
        </li>
      ))}
    </ol>
  );
}

export default function AcademyPage() {
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Как запустить кампанию коротких видео с оплатой за результат",
    step: clientSteps.map(([name, text]) => ({ "@type": "HowToStep", name, text }))
  };

  return (
    <AppShell>
      <main className={styles.page}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd).replace(/</g, "\u003c") }} />
        <header className={styles.hero}>
          <span><BookOpenCheck size={16} /> Академия ReelPay</span>
          <h1>От первого шага до проверенного результата</h1>
          <p>Два коротких маршрута без лишней теории. Выберите свою роль и сразу переходите к нужному действию.</p>
        </header>

        <section className={styles.roles} aria-label="Маршруты обучения">
          <article id="business">
            <header><BriefcaseBusiness size={22} /><div><span>Для бизнеса</span><h2>Запустить кампанию</h2></div></header>
            <Route steps={clientSteps} />
            <div className={styles.actions}>
              <Link className="btn btn-primary" href="/campaigns/new">Создать кампанию <ArrowRight size={16} /></Link>
              <Link href="/business/results">Разобраться в отчёте</Link>
            </div>
          </article>

          <article id="clipper">
            <header><Video size={22} /><div><span>Для клиппера</span><h2>Выполнить заказ</h2></div></header>
            <Route steps={workerSteps} />
            <div className={styles.actions}>
              <Link className="btn btn-primary" href="/campaigns">Найти заказ <ArrowRight size={16} /></Link>
              <Link href="/settings/account#social-accounts">Подключить площадку</Link>
            </div>
          </article>
        </section>

        <section className={styles.rules} aria-labelledby="academy-rules-title">
          <div className={styles.sectionHead}><span>Общее для обеих сторон</span><h2 id="academy-rules-title">Четыре правила спокойной работы</h2></div>
          <div>
            {rules.map(([Icon, title, text]) => (
              <article key={title}><Icon size={19} /><div><h3>{title}</h3><p>{text}</p></div></article>
            ))}
          </div>
        </section>

        <section className={styles.more}>
          <div><h2>Нужна подробность по конкретному вопросу?</h2><p>Безопасность бюджета, проверка просмотров и поддержка разобраны отдельно.</p></div>
          <nav aria-label="Дополнительные материалы">
            <Link href="/safety/budget">Защита бюджета</Link>
            <Link href="/safety/views">Проверка просмотров</Link>
            <Link href="/support">Задать вопрос</Link>
          </nav>
        </section>
      </main>
    </AppShell>
  );
}
