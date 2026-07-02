import Link from "next/link";
import {
  BadgeCheck,
  ChartNoAxesCombined,
  CircleDollarSign,
  Fingerprint,
  Scale,
  ShieldCheck
} from "lucide-react";
import styles from "./budget-protection.module.css";

const guarantees = [
  {
    icon: CircleDollarSign,
    title: "Бюджет резервируется",
    text: "При запуске кампании сумма переносится в защищённый резерв. После взятия заказа выплата закрепляется за конкретным клиппером."
  },
  {
    icon: BadgeCheck,
    title: "Оплата только после результата",
    text: "Начисление создаётся после достижения цели, проверки ссылки и подтверждения владения публикацией."
  },
  {
    icon: ShieldCheck,
    title: "Накрутка не оплачивается",
    text: "Подозрительная скорость просмотров, высокий fraud-score и провал проверки отправляют работу на ручную проверку."
  },
  {
    icon: Fingerprint,
    title: "Повторы и чужой контент проверяются",
    text: "ReelPay проверяет повторные ссылки, tracking-код и связь публикации с аккаунтом исполнителя."
  },
  {
    icon: Scale,
    title: "Решение можно обжаловать",
    text: "Спор фиксируется в поддержке и рассматривается по брифу, истории проверки и данным публикации."
  },
  {
    icon: ChartNoAxesCombined,
    title: "История результата сохраняется",
    text: "По каждому ролику остаются статусы, просмотры, реакции, проверки и история изменения показателей."
  }
];

export function BudgetProtection() {
  return (
    <section className={styles.section} aria-labelledby="budget-protection-title">
      <header className={styles.header}>
        <div>
          <span><ShieldCheck size={15} /> Безопасная сделка</span>
          <h2 id="budget-protection-title">Как мы защищаем бюджет заказчика</h2>
          <p>Деньги не уходят исполнителю по одному клику. Каждая выплата проходит через резерв, проверку результата и защитный период.</p>
        </div>
        <Link href="/safety/budget">Как работает защита</Link>
      </header>
      <div className={styles.grid}>
        {guarantees.map(({ icon: Icon, title, text }) => (
          <article key={title}>
            <span><Icon size={20} /></span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
      <aside className={styles.worker}>
        <div>
          <b>Защита клиппера</b>
          <span>До взятия заказа видны чистая выплата, дедлайн и требования.</span>
        </div>
        <div>
          <b>Деньги уже в резерве</b>
          <span>Оплачиваемый слот нельзя одновременно отдать другому исполнителю.</span>
        </div>
        <div>
          <b>Есть право на апелляцию</b>
          <span>Отклонение можно оспорить по сохранённой истории проверки.</span>
        </div>
      </aside>
      <footer>
        <b>Не согласны с решением?</b>
        <span>Создайте обращение — история проверки уже сохранена в системе.</span>
        <Link href="/support?new=1">Открыть спор</Link>
      </footer>
    </section>
  );
}
