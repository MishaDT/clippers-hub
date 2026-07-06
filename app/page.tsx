import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Megaphone, Scissors, WalletCards } from "lucide-react";
import { AppShell } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { CampaignGuide } from "@/app/campaigns/campaign-guide";
import { BudgetProtection } from "@/components/budget-protection";
import { LandingCalculator } from "@/components/landing-calculator";

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/campaigns");
  return (
    <AppShell>
      <section className="section lpa">
        {/* Hero */}
        <div className="lpa-hero">
          <span className="lpa-badge"><span className="star">✦</span> Оплата за просмотры · вывод на карту</span>
          <h1 className="lpa-title">Видео, которые <span>приносят деньги</span></h1>
          <p className="lpa-sub">
            Заказчики публикуют задания, клипперы режут рилсы из стримов и подкастов. Платим за просмотры.
          </p>
          <div className="lpa-cta">
            <Link className="lpa-btn lpa-btn--primary" href="/register?intent=worker&returnTo=%2Fcampaigns">
              Зарабатывать на клипах <ArrowRight size={18} />
            </Link>
            <Link className="lpa-btn lpa-btn--ghost" href="/register?intent=client&returnTo=%2Fcampaigns%2Fnew">Заказать клипы</Link>
          </div>
          <a className="lpa-how" href="#how">Как это работает ↓</a>
        </div>

        {/* Trust metrics */}
        <div className="lpa-metrics">
          <div><b>₽4,2 млн <small>Демо</small></b><span>пример оборота платформы</span></div>
          <div><b>1 800+ <small>Демо</small></b><span>пример активного сообщества</span></div>
          <div><b>320 <small>Демо</small></b><span>пример наполненной ленты</span></div>
        </div>

        {/* Video: how ReelPay works */}
        <div id="how">
          <CampaignGuide variant="general" />
        </div>

        {/* Steps */}
        <div className="lpa-steps">
          <article className="lpa-step">
            <div className="lpa-step-top">
              <span className="lpa-step-icon"><Megaphone size={22} /></span>
              <span className="lpa-step-num">Шаг 01</span>
            </div>
            <h3>Возьми заказ</h3>
            <p>Выбери задание в ленте — сразу видно оплату и дедлайн.</p>
          </article>
          <article className="lpa-step">
            <div className="lpa-step-top">
              <span className="lpa-step-icon"><Scissors size={22} /></span>
              <span className="lpa-step-num">Шаг 02</span>
            </div>
            <h3>Сделай клип</h3>
            <p>Смонтируй рилс из стрима или подкаста и выложи на площадку.</p>
          </article>
          <article className="lpa-step">
            <div className="lpa-step-top">
              <span className="lpa-step-icon"><WalletCards size={22} /></span>
              <span className="lpa-step-num">Шаг 03</span>
            </div>
            <h3>Получи деньги</h3>
            <p>Клип набирает просмотры — выплата падает в кошелёк.</p>
          </article>
        </div>

        <BudgetProtection />

        <LandingCalculator />

        {/* Roles */}
        <div className="lpa-roles-head">
          <h2>С чего начнёшь?</h2>
          <p>Выбери роль — это бесплатно и займёт минуту.</p>
        </div>
        <div className="lpa-roles">
          <Link className="lpa-role" href="/register?intent=client&returnTo=%2Fcampaigns%2Fnew">
            <span className="lpa-role-eyebrow">Я заказчик</span>
            <strong>Создаю кампании и получаю готовые видео</strong>
            <ul>
              <li>Публикуйте задания</li>
              <li>Получайте качественные клипы</li>
              <li>Смотрите аналитику</li>
            </ul>
            <em>Создать заказ</em>
          </Link>
          <Link className="lpa-role lpa-role--primary" href="/register?intent=worker&returnTo=%2Fcampaigns">
            <span className="lpa-role-badge">Популярно</span>
            <span className="lpa-role-eyebrow">Я клиппер</span>
            <strong>Выполняю заказы и зарабатываю на роликах</strong>
            <ul>
              <li>Находите интересные заказы</li>
              <li>Создавайте короткие видео</li>
              <li>Получайте вознаграждение</li>
            </ul>
            <em>Найти заказ <ArrowRight size={16} /></em>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
