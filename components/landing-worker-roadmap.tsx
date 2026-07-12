"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  FileCheck2,
  Search,
  Send,
  Scissors,
  SlidersHorizontal,
  Upload,
  WalletCards,
} from "lucide-react";
import styles from "./landing-worker-roadmap.module.css";

const workerSteps = [
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

const clientSteps = [
  {
    icon: Upload,
    title: "Добавьте исходник",
    text: "Прикрепите видео, из которого нужны короткие ролики.",
  },
  {
    icon: SlidersHorizontal,
    title: "Задайте условия",
    text: "Выберите формат, число публикаций, цель и срок.",
  },
  {
    icon: WalletCards,
    title: "Защитите бюджет",
    text: "Максимальная сумма резервируется до результата.",
  },
  {
    icon: FileCheck2,
    title: "Согласуйте ролики",
    text: "Посмотрите черновики до того, как они появятся в ленте.",
  },
  {
    icon: BadgeCheck,
    title: "Получите проверку",
    text: "ReelPay проверит публикации и подтверждённые просмотры.",
  },
  {
    icon: CircleDollarSign,
    title: "Оплатите результат",
    text: "Списывается подтверждённая сумма, остаток сохраняется.",
  },
] as const;

function LandingRoadmap({ audience }: { audience: "client" | "worker" }) {
  const isClient = audience === "client";
  const steps = isClient ? clientSteps : workerSteps;
  const titleId = isClient ? "client-roadmap-title" : "worker-roadmap-title";
  const mapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const running = inView && pageVisible && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.35),
      { threshold: [0, 0.35, 0.65] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    setActiveStep(0);
    setRunKey((value) => value + 1);
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % steps.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [running, steps.length]);

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.copy}>
        <span>{isClient ? <BriefcaseBusiness size={15} /> : <Scissors size={15} />} {isClient ? "Как проходит кампания" : "Как начать зарабатывать"}</span>
        <h2 id={titleId}>{isClient ? "От исходного видео до проверенного результата" : "От заказа до выплаты — один понятный путь"}</h2>
        <p>{isClient
          ? "Вы задаёте условия и видите каждый этап. ReelPay хранит договорённости, проверяет публикации и показывает, за что списаны деньги."
          : "Не нужно разбираться в сложных кабинетах. ReelPay показывает следующий шаг, хранит договорённости и проверяет результат."
        }</p>

        {isClient ? (
          <div className={styles.estimate} id="budget-calculator" aria-label="Пример расчёта кампании">
            <header><span>Пример расчёта</span><small>по выбранным условиям</small></header>
            <div>
              <span><b>3</b><small>публикации</small></span>
              <span><b>30 000</b><small>целевая выдача</small></span>
              <span><b>до 750 ₽</b><small>максимальный резерв</small></span>
            </div>
            <p>Цель — 10 тыс. просмотров на публикацию при ставке 25 ₽ за 1000. Фактическое списание зависит от подтверждённого результата.</p>
          </div>
        ) : null}

        <Link href={isClient ? "/register?intent=client&returnTo=%2Fcampaigns%2Fnew" : "/campaigns"}>
          {isClient ? "Запустить кампанию" : "Найти первый заказ"} <ArrowRight size={17} />
        </Link>
      </div>

      <div ref={mapRef} className={styles.map} aria-label={isClient ? "Шесть шагов от исходного видео до результата" : "Шесть шагов от выбора заказа до выплаты"}>
        <svg className={styles.road} viewBox="0 0 520 720" aria-hidden="true">
          <path className={styles.roadBase} d="M260 28 C92 52 92 142 260 155 S428 258 260 274 S92 378 260 394 S428 498 260 514 S92 618 260 692" />
          <path className={styles.roadProgress} d="M260 28 C92 52 92 142 260 155 S428 258 260 274 S92 378 260 394 S428 498 260 514 S92 618 260 692" />
          <g className={styles.traveller} transform={running ? undefined : "translate(260 28)"}>
            <circle r="17" />
            <circle className={styles.travellerCore} r="12" />
            <text x="0" y="3.5" textAnchor="middle">RP</text>
            {running ? (
              <animateMotion
                key={runKey}
                dur="9s"
                repeatCount="indefinite"
                path="M260 28 C92 52 92 142 260 155 S428 258 260 274 S92 378 260 394 S428 498 260 514 S92 618 260 692"
              />
            ) : null}
          </g>
        </svg>

        <div className={styles.steps}>
          {steps.map(({ icon: Icon, title, text }, index) => (
            <article className={styles.step} key={title} data-active={index === activeStep}>
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

export function LandingClientRoadmap() {
  return <LandingRoadmap audience="client" />;
}

export function LandingWorkerRoadmap() {
  return <LandingRoadmap audience="worker" />;
}
