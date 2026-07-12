"use client";

import { useState } from "react";
import { BadgeCheck, CircleDollarSign, FileCheck2, WalletCards } from "lucide-react";
import { LandingCalculator } from "@/components/landing-calculator";
import { LandingFaqChat } from "@/components/landing-faq-chat";
import { LandingMotionHero, type LandingAudience } from "@/components/landing-motion-hero";
import { LandingWorkerRoadmap } from "@/components/landing-worker-roadmap";
import { PilotLeadForm } from "@/components/pilot-lead-form";
import styles from "./landing-experience.module.css";

const guarantees = {
  client: [
    { icon: FileCheck2, title: "Условия задаёте вы", text: "формат, срок и бюджет" },
    { icon: CircleDollarSign, title: "Бюджет в резерве", text: "до проверки результата" },
    { icon: BadgeCheck, title: "Просмотры проверяются", text: "до списания средств" }
  ],
  worker: [
    { icon: FileCheck2, title: "Условия видны заранее", text: "задача, срок и площадка" },
    { icon: WalletCards, title: "Чистая сумма известна", text: "до взятия заказа" },
    { icon: BadgeCheck, title: "Выплата защищена", text: "бюджет уже в резерве" }
  ]
} as const;

export function LandingExperience() {
  const [audience, setAudience] = useState<LandingAudience>("client");

  return (
    <div className={styles.page}>
      <LandingMotionHero audience={audience} onAudienceChange={setAudience} />

      <section className={styles.trust} aria-label={audience === "client" ? "Гарантии заказчику" : "Гарантии клипперу"}>
        {guarantees[audience].map(({ icon: Icon, title, text }) => (
          <div key={title}><Icon size={19} /><span><b>{title}</b><small>{text}</small></span></div>
        ))}
      </section>

      <div className={styles.roleContent} key={audience}>
        {audience === "client" ? (
          <>
            <div className={styles.deferred}><LandingCalculator /></div>
            <div className={styles.deferred}><PilotLeadForm /></div>
            <div className={styles.deferred}><LandingFaqChat audience="client" /></div>
          </>
        ) : (
          <>
            <div className={styles.deferred}><LandingWorkerRoadmap /></div>
            <div className={styles.deferred}><LandingFaqChat audience="worker" /></div>
          </>
        )}
      </div>
    </div>
  );
}
