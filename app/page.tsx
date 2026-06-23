import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Search, TrendingUp, Video, WalletCards } from "lucide-react";
import { AppShell, Card, RoleChoice, Stat } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/feed");
  return (
    <AppShell>
      <section className="section lp-hero">
        <span className="lp-proof"><TrendingUp size={15} /> +₽2.4М выплачено клипперам</span>
        <h1>Видео, которые <span className="gradient-text">приносят деньги</span></h1>
        <p className="lead">Заказчики публикуют задания, клипперы режут рилсы из стримов и подкастов. Оплата — за просмотры.</p>
        <div className="lp-cta">
          <Link className="btn btn-primary btn-hero" href="/register">Зарабатывать на клипах <ArrowRight size={18} /></Link>
          <Link className="btn btn-ghost btn-hero" href="/register">Заказать клипы</Link>
        </div>
        <Link className="text-link lp-how-link" href="#how">Как это работает ↓</Link>
      </section>

      <section className="section step-cards lp-steps" id="how">
        <Card className="app-step">
          <span><Search size={24} /></span>
          <h3>Возьми заказ</h3>
          <p>Выбери задание в ленте — сразу видно оплату и дедлайн.</p>
          <b>01</b>
        </Card>
        <Card className="app-step">
          <span><Video size={24} /></span>
          <h3>Сделай клип</h3>
          <p>Смонтируй рилс из стрима или подкаста и выложи на площадку.</p>
          <b>02</b>
        </Card>
        <Card className="app-step money-step">
          <span><WalletCards size={24} /></span>
          <h3>Получи деньги</h3>
          <p>Клип набирает просмотры — выплата падает в кошелёк.</p>
          <b>03</b>
        </Card>
      </section>

      <section className="section role-section">
        <div>
          <h2>С чего начнёшь?</h2>
          <p className="muted">Выбери роль — это бесплатно и займёт минуту.</p>
        </div>
        <RoleChoice />
      </section>

      <section className="section grid grid-4 lp-stats">
        <Stat value="1 200+" label="заказов на клипы" />
        <Stat value="8.4М" label="просмотров у роликов" />
        <Stat value="₽2.4М" label="выплачено клипперам" tone="good" />
        <Stat value="4.9★" label="средняя оценка" />
      </section>
    </AppShell>
  );
}
