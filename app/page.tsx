import { redirect } from "next/navigation";
import { BadgeCheck, CircleDollarSign, FileCheck2 } from "lucide-react";
import { AppShell } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { LandingCalculator } from "@/components/landing-calculator";
import { LandingFaqChat } from "@/components/landing-faq-chat";
import { LandingMotionHero } from "@/components/landing-motion-hero";
import { PilotLeadForm } from "@/components/pilot-lead-form";
import styles from "./landing.module.css";

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/campaigns");

  return (
    <AppShell>
      <div className={styles.page}>
        <LandingMotionHero />

        <section className={styles.trust} aria-label="Как ReelPay защищает сделку">
          <div><FileCheck2 size={19} /><span><b>Условия видны заранее</b><small>задача, срок и сумма</small></span></div>
          <div><CircleDollarSign size={19} /><span><b>Бюджет в резерве</b><small>защищает обе стороны</small></span></div>
          <div><BadgeCheck size={19} /><span><b>Результат проверяется</b><small>до списания и выплаты</small></span></div>
        </section>

        <div className={styles.deferred}><LandingCalculator /></div>
        <div className={styles.deferred}><PilotLeadForm /></div>
        <div className={styles.deferred}><LandingFaqChat /></div>
      </div>
    </AppShell>
  );
}
