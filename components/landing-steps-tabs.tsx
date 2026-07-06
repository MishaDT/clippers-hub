"use client";

import { useState } from "react";
import { BriefcaseBusiness, Scissors } from "lucide-react";
import styles from "./landing-steps-tabs.module.css";

const flows = {
  client: [
    ["Создайте задание", "Вставьте ссылку на исходник, задайте цель и ставку — визард за 10 минут."],
    ["Клипперы публикуют нарезки", "Десятки исполнителей режут ваш контент и выкладывают ролики."],
    ["Платите за подтверждённые просмотры", "Оплата за реальный результат, неизрасходованный бюджет вернётся."]
  ],
  worker: [
    ["Возьми заказ", "Выбери задание в ленте — сразу видно оплату, гарантию и дедлайн."],
    ["Смонтируй и опубликуй", "Сделай рилс из стрима или подкаста и выложи на площадку."],
    ["Получи выплату", "После проверки просмотров деньги падают в кошелёк."]
  ]
} as const;

export function LandingStepsTabs() {
  const [role, setRole] = useState<"client" | "worker">("worker");
  const steps = flows[role];

  return (
    <section className={styles.section} id="how">
      <div className={styles.head}>
        <h2>Три шага — первые клипы обычно за 24–48 часов</h2>
        <div className={styles.tabs} role="tablist" aria-label="Выберите роль">
          <button type="button" role="tab" aria-selected={role === "worker"} data-active={role === "worker"} onClick={() => setRole("worker")}>
            <Scissors size={15} /> Я клиппер
          </button>
          <button type="button" role="tab" aria-selected={role === "client"} data-active={role === "client"} onClick={() => setRole("client")}>
            <BriefcaseBusiness size={15} /> Я заказчик
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {steps.map(([title, text], index) => (
          <article className={styles.step} key={title}>
            <span className={styles.num}>{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
