"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  FileVideo2,
  MousePointer2,
  Scissors,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import styles from "./landing-motion-hero.module.css";

export type LandingAudience = "client" | "worker";

const content = {
  client: {
    eyebrow: "Для заказчиков",
    title: <>Запускайте короткие ролики. <span>Платите за результат.</span></>,
    text: "Добавьте исходное видео и условия. Клипперы выберут кампанию, подготовят публикации, а ReelPay проверит просмотры и вернёт остаток.",
    primary: "Запустить кампанию",
    primaryHref: "/register?intent=client&returnTo=%2Fcampaigns%2Fnew",
    secondary: "Посмотреть пример расчёта",
    secondaryHref: "#budget-calculator",
    stages: ["Бриф", "Ролики", "Проверка"],
    scenes: [
      { label: "Кампания опубликована", value: "3 ролика", note: "Бюджет уже в резерве", action: "Посмотреть отклик", icon: BriefcaseBusiness },
      { label: "Клиппер взял заказ", value: "Черновик готов", note: "Можно согласовать до публикации", action: "Согласовать ролик", icon: FileVideo2 },
      { label: "Результат подтверждён", value: "30 000 просмотров", note: "Оплата только за проверенные данные", action: "Открыть отчёт", icon: BadgeCheck }
    ]
  },
  worker: {
    eyebrow: "Для клипперов",
    title: <>Выбирайте заказы. <span>Зарабатывайте на роликах.</span></>,
    text: "Выберите заказ, сделайте ролик и получите оплату после проверки.",
    primary: "Смотреть заказы",
    primaryHref: "/campaigns",
    secondary: "Создать профиль",
    secondaryHref: "/register?intent=worker&returnTo=%2Fcampaigns",
    stages: ["Заказ", "Публикация", "Выплата"],
    scenes: [
      { label: "Подходящий заказ", value: "до 450 ₽", note: "ТЗ и сумма видны до старта", action: "Взять заказ", icon: Sparkles },
      { label: "Ролик опубликован", value: "Ссылка принята", note: "ReelPay проверяет владельца и статистику", action: "Отправить ссылку", icon: FileVideo2 },
      { label: "Выплата защищена", value: "383 ₽ доступно", note: "Начисление после защитного окна", action: "Открыть кошелёк", icon: CircleDollarSign }
    ]
  }
} as const;

export function LandingMotionHero({
  audience,
  onAudienceChange
}: {
  audience: LandingAudience;
  onAudienceChange: (audience: LandingAudience) => void;
}) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const active = content[audience];
  const SceneIcon = active.scenes[step].icon;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (paused || reduced.matches || document.visibilityState === "hidden") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setStep((current) => (current + 1) % 3);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [audience, paused]);

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      aria-labelledby="landing-title"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!heroRef.current?.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className={styles.copy}>
        <div className={styles.switcher} role="tablist" aria-label="Выберите свою роль">
          <button type="button" role="tab" aria-selected={audience === "client"} onClick={() => { setStep(0); onAudienceChange("client"); }}>
            <BriefcaseBusiness size={16} /> Заказчикам
          </button>
          <button type="button" role="tab" aria-selected={audience === "worker"} onClick={() => { setStep(0); onAudienceChange("worker"); }}>
            <Scissors size={16} /> Клипперам
          </button>
        </div>
        <span className={styles.eyebrow}><ShieldCheck size={15} /> {active.eyebrow}</span>
        <h1 id="landing-title" key={`${audience}-title`}>{active.title}</h1>
        <p key={`${audience}-text`}>{active.text}</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href={active.primaryHref}>{active.primary} <ArrowRight size={18} /></Link>
          <a className={styles.secondary} href={active.secondaryHref}>{active.secondary}</a>
        </div>
      </div>

      <div className={styles.stage} aria-label={`Демонстрация пути: ${active.stages.join(", ")}`}>
        <i className={styles.glow} aria-hidden="true" />
        <div className={`${styles.floatCard} ${styles.floatOne}`} aria-hidden="true">Shorts <b>+12,4K</b></div>
        <div className={`${styles.floatCard} ${styles.floatTwo}`} aria-hidden="true">VK Клипы <b>готово</b></div>
        <div className={styles.product}>
          <header>
            <span className={styles.logo}>Reel<b>Pay</b></span>
            <em>{audience === "client" ? "Кампания" : "Моя работа"}</em>
          </header>
          <div className={styles.progress}>
            {active.stages.map((label, index) => (
              <button
                type="button"
                key={label}
                data-state={index < step ? "done" : index === step ? "active" : "idle"}
                onClick={() => setStep(index)}
                aria-label={`Показать этап: ${label}`}
                aria-pressed={index === step}
              >
                <span>{index < step ? <Check size={14} /> : index + 1}</span>
                <small>{label}</small>
              </button>
            ))}
          </div>
          <div className={styles.scene} key={`${audience}-${step}`}>
            <span className={styles.sceneIcon}><SceneIcon size={22} /></span>
            <small>{active.scenes[step].label}</small>
            <strong>{active.scenes[step].value}</strong>
            <p>{active.scenes[step].note}</p>
            <button
              className={styles.demoAction}
              type="button"
              onClick={() => setStep((step + 1) % 3)}
              aria-label={`${active.scenes[step].action}. Показать следующий шаг`}
            >
              {active.scenes[step].action} <ArrowRight size={14} />
            </button>
            <span className={styles.demoCursor} aria-hidden="true">
              <MousePointer2 size={24} fill="currentColor" />
              <i />
            </span>
          </div>
          <footer>
            <div>{active.stages.map((label, index) => <i key={label} data-active={index === step} />)}</div>
          </footer>
        </div>
      </div>
    </section>
  );
}
