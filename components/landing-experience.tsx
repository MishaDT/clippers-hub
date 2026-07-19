"use client";

import { useState } from "react";
import { LandingFaqChat } from "@/components/landing-faq-chat";
import { LandingMotionHero, type LandingAudience } from "@/components/landing-motion-hero";
import { LandingClientRoadmap, LandingWorkerRoadmap } from "@/components/landing-worker-roadmap";
import { PilotLeadForm } from "@/components/pilot-lead-form";
import styles from "./landing-experience.module.css";

export function LandingExperience() {
  const [audience, setAudience] = useState<LandingAudience>("client");

  return (
    <div className={styles.page}>
      <LandingMotionHero audience={audience} onAudienceChange={setAudience} />

      <div className={styles.roleContent} id="how" key={audience}>
        {audience === "client" ? (
          <>
            <div className={styles.deferred}><LandingClientRoadmap /></div>
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
