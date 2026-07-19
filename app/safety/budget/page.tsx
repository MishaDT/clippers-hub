import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleDollarSign, Fingerprint, Scale, ShieldCheck, TimerReset } from "lucide-react";
import { AppShell } from "@/components/ui";
import { commissionRate, expectedPayout, grossPayout, rub } from "@/lib/money";
import styles from "./budget.module.css";

export const metadata: Metadata = {
  title: "Защита бюджета — ReelPay",
  description: "Как ReelPay резервирует деньги, проверяет публикации и рассматривает апелляции."
};

const views = 10_000;
const cpm = 4_500;
const gross = grossPayout(views, cpm);
const net = expectedPayout(views, cpm, "BRONZE");
const fee = gross - net;

const cards = [
  [CircleDollarSign, "Бюджет замораживается", "При создании кампании деньги списываются с доступного баланса в резерв. Кампания не запускается без полного финансирования."],
  [Fingerprint, "Слот закрепляется за исполнителем", "Когда клиппер берёт заказ, сумма конкретного результата резервируется за ним атомарно. Последний слот нельзя выдать дважды."],
  [BadgeCheck, "Платим после проверок", "Если в заказе есть минимальная гарантия, проверенный ролик к дедлайну получает не меньше неё. При большем числе просмотров выплата растёт по ставке, но не выше зарезервированного максимума."],
  [TimerReset, "Есть защитное окно 48 часов", "После достижения цели начисление сначала находится на проверке и только затем становится доступным исполнителю."],
  [Scale, "Апелляция останавливает выплату", "Открытый спор видят обе стороны и администратор. Выдача связанной выплаты блокируется до решения."],
  [ShieldCheck, "Остаток возвращается", "После завершения кампании незарезервированная и неизрасходованная часть бюджета возвращается заказчику."]
] as const;

export default function BudgetSafetyPage() {
  return (
    <AppShell>
      <main className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Защищённая сделка</span>
          <h1>Как ReelPay защищает бюджет заказчика</h1>
          <p>Здесь только те гарантии, которые обеспечены текущей логикой платформы: резерв, проверка публикации, защитное окно и спор по сохранённым фактам.</p>
        </header>

        <section className={styles.grid} aria-label="Механизмы защиты">
          {cards.map(([Icon, title, text]) => (
            <article className={styles.card} key={title}>
              <span><Icon size={22} /></span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className={styles.example} aria-labelledby="payout-example">
          <div>
            <h2 id="payout-example">Пример расчёта</h2>
            <p>Та же функция используется при создании кампании, резерве и фактическом начислении.</p>
          </div>
          <div className={styles.metric}><b>{rub(gross)}</b><span>стоимость результата для заказчика</span></div>
          <div className={styles.metric}><b>{rub(fee)}</b><span>комиссия новичка · {Math.round(commissionRate("BRONZE") * 100)}%</span></div>
          <div className={styles.metric}><b>{rub(net)}</b><span>чистая выплата клипперу</span></div>
        </section>

        <section className={styles.rule}>
          <h2>Что считается подтверждённым результатом</h2>
          <ol>
            <li><b>Ссылка на ролик открывается.</b> ReelPay должен увидеть публикацию и её статистику. Если площадка не отдаёт данные автоматически, ролик проверит модератор.</li>
            <li><b>Эта ссылка ещё не использовалась.</b> Один и тот же ролик нельзя сдать повторно в другой заказ.</li>
            <li><b>Понятно, кому принадлежит ролик.</b> Мы сверяем подключённый аккаунт или код ReelPay. Если автоматической проверки нет, подтверждение делает модератор.</li>
            <li><b>Выполнено условие оплаты.</b> За достигнутую цель начисляется сумма по просмотрам. Если указан гарантированный минимум, проверенный ролик получит его к дедлайну.</li>
            <li><b>Просмотры не вызывают серьёзных сомнений.</b> Необычный рост ставит выплату на паузу и отправляет ролик человеку на проверку. Это ещё не означает накрутку.</li>
            <li><b>По работе нет открытого спора.</b> Если одна из сторон подала апелляцию, деньги остаются в резерве до решения поддержки.</li>
          </ol>
          <div className={styles.actions}>
            <Link className="btn btn-primary" href="/campaigns/new">Создать защищённую кампанию</Link>
            <Link className="btn" href="/legal/terms">Условия сервиса</Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
