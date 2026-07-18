import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Clock3, FileText, ShieldCheck, Wallet, X } from "lucide-react";
import { AppShell } from "@/components/ui";
import { LandingCalculator } from "@/components/landing-calculator";
import styles from "./business.module.css";
import { getCurrentUser } from "@/lib/auth";
import { setRoleModeAction } from "@/app/actions";

export const metadata: Metadata = {
  title: "Клип-маркетинг для бизнеса — ReelPay",
  description: "Запустите клип-кампанию самостоятельно без менеджеров и звонков. Бюджет в эскроу, оплата за проверенный результат, остаток возвращается."
};

const guarantees = [
  [ShieldCheck, "Бюджет в эскроу", "Деньги замораживаются при запуске и списываются только за подтверждённый результат."],
  [BadgeCheck, "Оплата за проверенный результат", "Считаем через API площадок там, где он доступен, и дополнительно проверяем владение и накрутку."],
  [FileText, "Отчёт по каждому клипу", "Графики просмотров, статусы проверок и история — всё сохраняется."],
  [Wallet, "Остаток возвращается", "Неизрасходованный бюджет мгновенно возвращается на баланс без комиссии."]
] as const;

const compareRows = [
  ["Запуск кампании", "Заявка → менеджер → счёт → ожидание", "Пошаговый самостоятельный запуск"],
  ["Когда начинается работа", "После согласований по телефону/почте", "Как только бюджет в эскроу"],
  ["Контроль бюджета", "На стороне менеджера", "Вы видите резерв и расход в реальном времени"],
  ["Проверка результата", "На доверии", "Официальные API + антифрод + защитное окно"],
  ["Оплата", "По договорённости", "За проверенный результат или указанную гарантию, остаток назад"]
] as const;

export default async function BusinessPage() {
  const user = await getCurrentUser();
  return (
    <AppShell>
      <main className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Для бизнеса</span>
          <h1>Запустите клип-кампанию самостоятельно. Без менеджеров и звонков</h1>
          <p>Вставьте ссылку на исходник, задайте нужное число роликов, цель и ставку. Вы платите за проверенный результат или указанную минимальную гарантию, а неизрасходованный бюджет возвращается.</p>
          <div className={styles.cta}>
            {user ? (
              <form action={setRoleModeAction}>
                <input type="hidden" name="mode" value="client" />
                <input type="hidden" name="returnTo" value="/campaigns/new" />
                <button className="btn btn-primary" type="submit">Создать кампанию <ArrowRight size={17} /></button>
              </form>
            ) : (
              <Link className="btn btn-primary" href="/register?intent=client&returnTo=%2Fcampaigns%2Fnew">Создать кампанию <ArrowRight size={17} /></Link>
            )}
            <Link className="btn" href="/safety/budget">Как защищён бюджет</Link>
          </div>
        </header>

        <section className={styles.guarantees} aria-label="Гарантии для бизнеса">
          {guarantees.map(([Icon, title, text]) => (
            <article key={title}>
              <span><Icon size={20} /></span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className={styles.compare} aria-labelledby="compare-title">
          <h2 id="compare-title"><Clock3 size={19} /> Как у других и как в ReelPay</h2>
          <div className={styles.compareTable}>
            <div className={`${styles.compareHead} ${styles.compareRow}`}>
              <span>Этап</span>
              <span>Через менеджера</span>
              <span>ReelPay (сами)</span>
            </div>
            {compareRows.map(([label, other, ours]) => (
              <div className={styles.compareRow} key={label}>
                <span className={styles.compareLabel}>{label}</span>
                <span className={styles.compareOther}><X size={14} /> {other}</span>
                <span className={styles.compareOurs}><Check size={14} /> {ours}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.calc}>
          <LandingCalculator />
        </section>
      </main>
    </AppShell>
  );
}
