import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Scissors, WalletCards } from "lucide-react";
import { AppShell } from "@/components/ui";
import styles from "../info.module.css";

export const metadata: Metadata = {
  title: "О сервисе — ReelPay",
  description: "Как ReelPay связывает заказчиков и создателей коротких видео."
};

export default function AboutPage() {
  return (
    <AppShell>
      <article className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">О сервисе</span>
          <h1>Заказчики получают ролики. Исполнители получают оплату.</h1>
          <p>ReelPay помогает превратить длинное видео или стрим в короткие ролики для социальных сетей.</p>
        </header>

        <section className={styles.section} id="how-it-works">
          <h2>Как это работает</h2>
          <div className={styles.steps}>
            <div><BarChart3 /><b>1. Заказ</b><p>Заказчик описывает задачу, указывает бюджет и условия.</p></div>
            <div><Scissors /><b>2. Ролик</b><p>Исполнитель выбирает заказ, монтирует и публикует видео.</p></div>
            <div><WalletCards /><b>3. Результат</b><p>Сервис проверяет работу и учитывает просмотры для выплаты.</p></div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Кому подходит</h2>
          <p><b>Заказчикам:</b> блогерам, стримерам и командам, которым нужны короткие видео без ручного поиска исполнителей.</p>
          <p><b>Исполнителям:</b> монтажёрам и авторам, которые хотят выбирать понятные задания и видеть условия оплаты заранее.</p>
        </section>

        <div className={styles.actions}>
          <Link className="btn btn-primary" href="/register">Начать</Link>
          <Link className="btn" href="/help">Частые вопросы</Link>
        </div>
      </article>
    </AppShell>
  );
}
