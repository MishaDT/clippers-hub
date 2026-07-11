import Link from "next/link";
import { ArrowLeft, Coins, Megaphone, Trophy } from "lucide-react";
import { AppShell } from "@/components/ui";

export default function RpHelpPage() {
  return (
    <AppShell>
      <main className="section legal-page">
        <Link className="wallet-back" href="/wallet?tab=rp"><ArrowLeft size={17} /> В кошелёк</Link>
        <span className="eyebrow"><Coins size={15} /> Бонусная система</span>
        <h1>Что такое RP</h1>
        <p className="lead">RP нужны для продвижения своих кампаний внутри ReelPay. 1 RP равен 1 ₽ внутреннего баланса.</p>
        <section><h2>Откуда берутся RP</h2><p>Купленные RP создаются при переводе рублей из кошелька. Бонусные RP начисляются за достижения и недельные задания.</p></section>
        <section><h2>Как расходуются</h2><p><Megaphone size={17} /> 100 RP продлевают продвижение активной кампании на 24 часа. Сначала система использует бонусные RP, затем купленные.</p></section>
        <section><h2>Что можно вернуть</h2><p>Купленные RP можно в любой момент вернуть на внутренний рублёвый баланс по курсу 1:1. Бонусные RP не выводятся и не конвертируются обратно.</p></section>
        <section><h2>Недельные задания</h2><p><Trophy size={17} /> Награды обновляются по понедельникам по московскому времени. За неделю можно получить не больше 120 бонусных RP.</p></section>
      </main>
    </AppShell>
  );
}
