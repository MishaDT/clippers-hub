"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Calculator, Check, ShieldCheck } from "lucide-react";
import styles from "./landing-calculator.module.css";

export function LandingCalculator() {
  const [count, setCount] = useState(3);
  const [views, setViews] = useState(10_000);
  const [cpm, setCpm] = useState(25);
  const [deadline, setDeadline] = useState(7);

  const estimate = useMemo(() => {
    const perResult = Math.max(0, Math.round((views / 1000) * cpm));
    return {
      perResult,
      reserve: perResult * count,
      targetViews: views * count
    };
  }, [count, cpm, views]);

  const campaignDraft = `/campaigns/new?deliverableCount=${count}&viewThreshold=${views}&cpm=${cpm}&deadlineDays=${deadline}&budget=${estimate.reserve}`;
  const clientHref = `/register?intent=client&returnTo=${encodeURIComponent(campaignDraft)}`;

  return (
    <section className={styles.section} id="budget-calculator" aria-labelledby="budget-calculator-title">
      <div className={styles.copy}>
        <span><ShieldCheck size={15} /> Оплата за подтверждённый результат</span>
        <h2 id="budget-calculator-title">Рассчитайте бюджет кампании</h2>
        <p>Задайте количество публикаций, цель по просмотрам и ставку. ReelPay соберёт публикации, проверит результат и вернёт неиспользованный остаток.</p>
        <ul>
          <li><Check size={15} /> Деньги резервируются до результата</li>
          <li><Check size={15} /> Накрутка и чужие публикации проверяются</li>
          <li><Check size={15} /> По каждому ролику сохраняется отчёт</li>
        </ul>
      </div>

      <div className={styles.calculator}>
        <header><Calculator size={19} /><div><b>Калькулятор кампании</b><span>Оценка, не гарантия просмотров</span></div></header>
        <div className={styles.fields}>
          <label><span>Публикаций</span><input type="number" min={1} max={20} value={count} onChange={(event) => setCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
          <label><span>Цель на ролик</span><select value={views} onChange={(event) => setViews(Number(event.target.value))}><option value={5000}>5 тыс.</option><option value={10000}>10 тыс.</option><option value={25000}>25 тыс.</option><option value={50000}>50 тыс.</option></select></label>
          <label><span>₽ за 1000 <em>рынок 10–35</em></span><input type="number" min={10} step={5} value={cpm} onChange={(event) => setCpm(Math.max(10, Number(event.target.value) || 10))} /></label>
          <label><span>Срок</span><select value={deadline} onChange={(event) => setDeadline(Number(event.target.value))}><option value={3}>3 дня</option><option value={7}>7 дней</option><option value={14}>14 дней</option><option value={30}>30 дней</option></select></label>
        </div>
        <div className={styles.result}>
          <span><small>Резерв максимум</small><b>{estimate.reserve.toLocaleString("ru-RU")} ₽</b></span>
          <span><small>За результат</small><b>{estimate.perResult.toLocaleString("ru-RU")} ₽</b></span>
          <span><small>Целевая выдача</small><b>{estimate.targetViews.toLocaleString("ru-RU")}</b></span>
        </div>
        <Link href={clientHref} onClick={() => {
          void fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "CALCULATOR_COMPLETE",
              path: "/",
              metadata: { count, views, cpm, deadline, reserve: estimate.reserve }
            }),
            keepalive: true
          });
        }}>Перенести расчёт в кампанию <ArrowRight size={17} /></Link>
        <p>Списание происходит только после проверки. Неиспользованный свободный остаток возвращается на баланс.</p>
      </div>
    </section>
  );
}
