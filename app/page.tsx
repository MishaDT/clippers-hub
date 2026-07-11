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
import { LandingMotionHero } from "@/components/landing-motion-hero";
import styles from "./landing.module.css";

const steps = [
  {
    icon: FileVideo2,
    number: "01",
    title: "Заказчик публикует задачу",
    text: "Добавляет исходник, требования, площадки и бюджет."
  },
  {
    icon: BadgeCheck,
    number: "02",
    title: "Клиппер создаёт ролик",
    text: "Выбирает заказ, согласует черновик и публикует результат."
  },
  {
    icon: ChartNoAxesCombined,
    number: "03",
    title: "ReelPay проводит оплату",
    text: "Проверяет публикацию и переводит деньги из резерва."
  }
];

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/campaigns");

  return (
    <AppShell>
      <div className={styles.page}>
        <LandingMotionHero />

        <section className={styles.trust} aria-label="Главные гарантии ReelPay">
          <div><CircleDollarSign size={19} /><span><b>Бюджет в резерве</b><small>до подтверждения результата</small></span></div>
          <div><BadgeCheck size={19} /><span><b>Просмотры проверяются</b><small>повторы и накрутка не оплачиваются</small></span></div>
          <div><RotateCcw size={19} /><span><b>Остаток возвращается</b><small>на ваш баланс без заявки</small></span></div>
        </section>

        <section className={`${styles.audiences} ${styles.deferred}`} aria-labelledby="audiences-title">
          <header>
            <span>Одна платформа — две роли</span>
            <h2 id="audiences-title">Каждому сразу понятно, что делать дальше</h2>
          </header>
          <div>
            <article>
              <span>Заказчикам</span>
              <h3>Превращайте готовый контент в новые охваты</h3>
              <p>Создайте кампанию, согласуйте черновики и следите за каждым опубликованным роликом.</p>
              <ul><li><Check size={15} /> Бюджет в резерве</li><li><Check size={15} /> Проверка просмотров</li><li><Check size={15} /> Отчёт по результату</li></ul>
              <Link href="/register?intent=client&returnTo=%2Fcampaigns%2Fnew">Создать кампанию <ArrowRight size={16} /></Link>
            </article>
            <article>
              <span>Клипперам</span>
              <h3>Монетизируйте навык монтажа без поиска клиента</h3>
              <p>Выбирайте понятные заказы, публикуйте ролики и получайте выплату из зарезервированного бюджета.</p>
              <ul><li><Check size={15} /> Сумма видна заранее</li><li><Check size={15} /> Заказы в каталоге</li><li><Check size={15} /> Защищённая выплата</li></ul>
              <Link href="/campaigns">Найти заказ <ArrowRight size={16} /></Link>
            </article>
          </div>
        </section>

        <section className={`${styles.how} ${styles.deferred}`} id="how" aria-labelledby="how-title">
          <header>
            <span>Три понятных шага</span>
            <h2 id="how-title">Заказчик и клиппер работают в одном процессе</h2>
            <p>Задача, обсуждение, проверка и деньги остаются внутри ReelPay.</p>
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
