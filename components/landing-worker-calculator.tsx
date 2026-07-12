"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Calculator, Scissors } from "lucide-react";
import { commissionRate, expectedPayout, grossPayout } from "@/lib/money";
import styles from "./landing-worker-calculator.module.css";

const ranks = [
  { value: "BRONZE", label: "Новичок", fee: "15%" },
  { value: "SILVER", label: "Серебро", fee: "13%" },
  { value: "GOLD", label: "Золото", fee: "11%" },
  { value: "DIAMOND", label: "Алмаз", fee: "9%" },
  { value: "LEGENDARY", label: "Легенда", fee: "7%" }
] as const;

export function LandingWorkerCalculator() {
  const [views, setViews] = useState(10_000);
  const [cpm, setCpm] = useState(25);
  const [rank, setRank] = useState("BRONZE");

  const result = useMemo(() => {
    const grossCents = grossPayout(views, cpm * 100);
    const netCents = expectedPayout(views, cpm * 100, rank);
    return {
      gross: grossCents / 100,
      fee: (grossCents - netCents) / 100,
      net: netCents / 100,
      feeRate: Math.round(commissionRate(rank) * 100)
    };
  }, [cpm, rank, views]);

  return (
    <section className={styles.section} aria-labelledby="worker-calculator-title">
      <div className={styles.copy}>
        <span><Scissors size={15} /> Для клиппера</span>
        <h2 id="worker-calculator-title">Посчитайте чистую выплату</h2>
        <p>В реальной карточке заказа ReelPay сразу показывает итоговую сумму. Здесь можно оценить доход по просмотрам, ставке и вашей лиге.</p>
      </div>

      <div className={styles.calculator}>
        <header><Calculator size={19} /><div><b>Калькулятор заработка</b><span>Оценка за один подтверждённый ролик</span></div></header>
        <div className={styles.fields}>
          <label><span>Просмотры</span><select value={views} onChange={(event) => setViews(Number(event.target.value))}><option value={5000}>5 тыс.</option><option value={10000}>10 тыс.</option><option value={25000}>25 тыс.</option><option value={50000}>50 тыс.</option><option value={100000}>100 тыс.</option></select></label>
          <label><span>Ставка за 1000, ₽</span><input type="number" min={10} max={500} step={5} value={cpm} onChange={(event) => setCpm(Math.max(10, Math.min(500, Number(event.target.value) || 10)))} /></label>
          <label className={styles.wide}><span>Лига</span><select value={rank} onChange={(event) => setRank(event.target.value)}>{ranks.map((item) => <option key={item.value} value={item.value}>{item.label} · комиссия {item.fee}</option>)}</select></label>
        </div>
        <div className={styles.result}>
          <span><small>Начисление</small><b>{result.gross.toLocaleString("ru-RU")} ₽</b></span>
          <span><small>Комиссия {result.feeRate}%</small><b>−{result.fee.toLocaleString("ru-RU")} ₽</b></span>
          <span className={styles.net}><small>Вы получите</small><b>{result.net.toLocaleString("ru-RU")} ₽</b></span>
        </div>
        <Link href="/campaigns">Открыть заказы <ArrowRight size={17} /></Link>
        <p>Это ориентир. Точная чистая выплата всегда указана в карточке конкретного заказа до его принятия.</p>
      </div>
    </section>
  );
}
