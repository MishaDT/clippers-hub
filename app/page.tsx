import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, Check, Scissors } from "lucide-react";
import { AppShell } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { CampaignGuide } from "@/app/campaigns/campaign-guide";
import { BudgetProtection } from "@/components/budget-protection";
import { LandingCalculator } from "@/components/landing-calculator";
import { LandingFaqChat } from "@/components/landing-faq-chat";
import { LandingPhone } from "@/components/landing-phone";
import { LandingStepsTabs } from "@/components/landing-steps-tabs";

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/campaigns");
  return (
    <AppShell>
      <section className="section lpa">
        {/* Hero */}
        <div className="lpa-hero-grid">
          <div className="lpa-hero lpa-hero--left">
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
          <LandingPhone />
        </div>

        {/* Trust metrics */}
        <div className="lpa-metrics">
          <div><b>₽4,2 млн <small>Демо</small></b><span>пример оборота платформы</span></div>
          <div><b>1 800+ <small>Демо</small></b><span>пример активного сообщества</span></div>
          <div><b>320 <small>Демо</small></b><span>пример наполненной ленты</span></div>
        </div>

        {/* Video: how ReelPay works */}
        <CampaignGuide variant="general" />

        {/* Steps with role tabs */}
        <LandingStepsTabs />

        <BudgetProtection />

        <LandingCalculator />

        <LandingFaqChat />

        {/* Roles — double track */}
        <div className="lpa-roles-head">
          <h2>С чего начнёшь?</h2>
          <p>Выбери роль — это бесплатно и займёт минуту.</p>
        </div>
        <div className="lpa-roles">
          <Link className="lpa-role" href="/register?intent=client&returnTo=%2Fcampaigns%2Fnew">
            <span className="lpa-role-eyebrow"><BriefcaseBusiness size={15} /> Заказчикам</span>
            <strong>Десятки нарезок из вашего контента</strong>
            <ul>
              <li><Check size={15} /> Платите только за подтверждённые просмотры</li>
              <li><Check size={15} /> Бюджет в эскроу, остаток возвращается</li>
              <li><Check size={15} /> Отчёт и аналитика по каждому клипу</li>
            </ul>
            <em>Создать задание</em>
          </Link>
          <Link className="lpa-role lpa-role--primary" href="/register?intent=worker&returnTo=%2Fcampaigns">
            <span className="lpa-role-badge">Популярно</span>
            <span className="lpa-role-eyebrow"><Scissors size={15} /> Клипперам</span>
            <strong>Зарабатывай на нарезках</strong>
            <ul>
              <li><Check size={15} /> Выплаты на карту, вывод без минималки</li>
              <li><Check size={15} /> Деньги уже в резерве до старта работы</li>
              <li><Check size={15} /> Ставка и гарантия видны сразу</li>
            </ul>
            <em>Стать клиппером <ArrowRight size={16} /></em>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
