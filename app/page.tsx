import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  ChartNoAxesCombined,
  Check,
  CircleDollarSign,
  FileVideo2,
  RotateCcw,
  ShieldCheck
} from "lucide-react";
import { AppShell } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { LandingCalculator } from "@/components/landing-calculator";
import { LandingFaqChat } from "@/components/landing-faq-chat";
import { PilotLeadForm } from "@/components/pilot-lead-form";
import styles from "./landing.module.css";

const steps = [
  {
    icon: FileVideo2,
    number: "01",
    title: "Добавьте исходное видео",
    text: "Ссылка, короткий бриф, число публикаций и площадки."
  },
  {
    icon: BadgeCheck,
    number: "02",
    title: "Согласуйте ролики",
    text: "Проверьте черновики до публикации и запросите правки."
  },
  {
    icon: ChartNoAxesCombined,
    number: "03",
    title: "Платите за результат",
    text: "ReelPay проверит публикации и подтверждённые просмотры."
  }
];

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/campaigns");

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><ShieldCheck size={15} /> Для авторов, экспертов и брендов</span>
            <h1 id="landing-title">Короткие ролики из вашего контента — <span>с оплатой за результат</span></h1>
            <p>Добавьте исходное видео, задайте цель и бюджет. Клипперы подготовят публикации, ReelPay проверит просмотры и вернёт неиспользованный остаток.</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#budget-calculator">Рассчитать бюджет <ArrowRight size={18} /></a>
              <a className={styles.secondary} href="#protection">Как защищён бюджет</a>
            </div>
            <Link className={styles.workerLink} href="/campaigns">Я клиппер — найти заказ <ArrowRight size={15} /></Link>
          </div>

          <div className={styles.preview} aria-label="Как проходит кампания ReelPay">
            <div className={styles.previewHead}>
              <div><span>Пилотная кампания</span><strong>3 коротких ролика</strong></div>
              <b>В работе</b>
            </div>
            <div className={styles.flow}>
              <div data-state="done"><Check size={16} /><span>Бриф</span></div>
              <i />
              <div data-state="active"><FileVideo2 size={16} /><span>Ролики</span></div>
              <i />
              <div><BadgeCheck size={16} /><span>Проверка</span></div>
            </div>
            <div className={styles.previewResult}>
              <span><small>Бюджет в резерве</small><strong>15 000 ₽</strong></span>
              <span><small>Цель</small><strong>30 тыс.</strong></span>
            </div>
            <p><ShieldCheck size={16} /> Исполнитель получает выплату только после проверки результата.</p>
          </div>
        </section>

        <section className={styles.trust} aria-label="Главные гарантии ReelPay">
          <div><CircleDollarSign size={19} /><span><b>Бюджет в резерве</b><small>до подтверждения результата</small></span></div>
          <div><BadgeCheck size={19} /><span><b>Просмотры проверяются</b><small>повторы и накрутка не оплачиваются</small></span></div>
          <div><RotateCcw size={19} /><span><b>Остаток возвращается</b><small>на ваш баланс без заявки</small></span></div>
        </section>

        <section className={`${styles.how} ${styles.deferred}`} id="how" aria-labelledby="how-title">
          <header>
            <span>Три понятных шага</span>
            <h2 id="how-title">От исходника до проверенного результата</h2>
            <p>Вся работа, согласование и статистика остаются в одной кампании.</p>
          </header>
          <div className={styles.steps}>
            {steps.map(({ icon: Icon, number, title, text }) => (
              <article key={number}>
                <span><Icon size={20} /></span>
                <small>{number}</small>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.deferred}><LandingCalculator /></div>

        <section className={`${styles.protection} ${styles.deferred}`} id="protection" aria-labelledby="protection-title">
          <div>
            <span><ShieldCheck size={15} /> Безопасная сделка</span>
            <h2 id="protection-title">Деньги не уходят исполнителю одним кликом</h2>
            <p>Каждая выплата проходит через резерв, проверку публикации и защитное окно.</p>
          </div>
          <ul>
            <li><Check size={17} /><span><b>Проверяем владельца и ссылку</b><small>Чужие и повторные публикации блокируются.</small></span></li>
            <li><Check size={17} /><span><b>Сохраняем историю статистики</b><small>По каждому ролику видны проверки и решение.</small></span></li>
            <li><Check size={17} /><span><b>Разбираем спор по данным</b><small>Решение можно обжаловать через поддержку.</small></span></li>
          </ul>
          <Link href="/safety/budget">Подробнее о защите бюджета <ArrowRight size={16} /></Link>
        </section>

        <div className={styles.deferred}><PilotLeadForm /></div>
        <div className={styles.deferred}><LandingFaqChat /></div>
      </div>
    </AppShell>
  );
}
