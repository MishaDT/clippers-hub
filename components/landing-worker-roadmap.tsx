import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  FileCheck2,
  Search,
  Send,
  Scissors,
} from "lucide-react";
import styles from "./landing-worker-roadmap.module.css";

const steps = [
  {
    icon: Search,
    title: "Найдите заказ",
    text: "Сразу видны задача, срок и сумма к выплате.",
  },
  {
    icon: FileCheck2,
    title: "Возьмите в работу",
    text: "Подтвердите условия — бюджет уже защищён.",
  },
  {
    icon: Scissors,
    title: "Подготовьте ролик",
    text: "Соберите короткий клип и отправьте черновик.",
  },
  {
    icon: Send,
    title: "Опубликуйте",
    text: "После согласования разместите ролик и добавьте ссылку.",
  },
  {
    icon: BadgeCheck,
    title: "Дождитесь проверки",
    text: "ReelPay подтвердит публикацию и реальные просмотры.",
  },
  {
    icon: CircleDollarSign,
    title: "Получите выплату",
    text: "Подтверждённая сумма появится на вашем балансе.",
  },
] as const;

export function LandingWorkerRoadmap() {
  return (
    <section className={styles.section} aria-labelledby="worker-roadmap-title">
      <div className={styles.copy}>
        <span><Scissors size={15} /> Как начать зарабатывать</span>
        <h2 id="worker-roadmap-title">От заказа до выплаты — один понятный путь</h2>
        <p>
          Не нужно разбираться в сложных кабинетах. ReelPay показывает следующий шаг,
          хранит договорённости и проверяет результат.
        </p>
        <Link href="/campaigns">Найти первый заказ <ArrowRight size={17} /></Link>
      </div>

      <div className={styles.map} aria-label="Шесть шагов от выбора заказа до выплаты">
        <svg className={styles.road} viewBox="0 0 520 720" aria-hidden="true">
          <path className={styles.roadBase} d="M260 28 C92 52 92 142 260 155 S428 258 260 274 S92 378 260 394 S428 498 260 514 S92 618 260 692" />
          <path className={styles.roadProgress} d="M260 28 C92 52 92 142 260 155 S428 258 260 274 S92 378 260 394 S428 498 260 514 S92 618 260 692" />
          <g className={styles.traveller}>
            <circle r="17" />
            <circle className={styles.travellerCore} r="12" />
            <text x="0" y="3.5" textAnchor="middle">RP</text>
            <animateMotion
              dur="12s"
              repeatCount="indefinite"
              path="M260 28 C92 52 92 142 260 155 S428 258 260 274 S92 378 260 394 S428 498 260 514 S92 618 260 692"
            />
          </g>
        </svg>

        <div className={styles.steps}>
          {steps.map(({ icon: Icon, title, text }, index) => (
            <article className={styles.step} key={title} style={{ "--step": index } as React.CSSProperties}>
              <span className={styles.number}>{index + 1}</span>
              <span className={styles.icon}><Icon size={18} /></span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
