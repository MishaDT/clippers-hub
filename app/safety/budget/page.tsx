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
    <AppShell publicOnly>
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
            <li><b>Публичная ссылка.</b> Статистика должна быть доступна поддерживаемому провайдеру либо пройти ручную проверку.</li>
            <li><b>Уникальная публикация.</b> Повторно сданная ссылка блокируется.</li>
            <li><b>Подтверждение владения.</b> Для проверяемых площадок система ищет tracking-код; для остальных требуется ручное подтверждение.</li>
            <li><b>Достигнута цель или наступил дедлайн с гарантией.</b> При цели выплачивается зарезервированный максимум; при гарантии — максимум из гарантии и суммы за фактические просмотры.</li>
            <li><b>Нет блокирующей аномалии.</b> При fraud-score 70% и выше работа не переходит к выплате и требует проверки.</li>
            <li><b>Нет открытого спора.</b> Апелляция приостанавливает выдачу денег до решения администратора.</li>
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
