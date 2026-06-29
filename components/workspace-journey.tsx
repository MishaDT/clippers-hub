"use client";

import Link from "next/link";
import { Check, Link2, LockKeyhole, Radar, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

type JourneyStep = {
  key: string;
  title: string;
  done: boolean;
  active: boolean;
  detail: string;
  metric?: string;
  href?: string;
};

const ICONS = { accepted: Check, link: Link2, tracking: Radar, payout: WalletCards };

export function WorkspaceJourney({
  submissionId,
  status,
  steps
}: {
  submissionId: string;
  status: string;
  steps: JourneyStep[];
}) {
  const [unlocked, setUnlocked] = useState<string | null>(null);

  useEffect(() => {
    const storageKey = `journey:${submissionId}`;
    const previous = Number(localStorage.getItem(storageKey) || 0);
    const current = steps.filter((step) => step.done).length;
    if (current > previous && previous > 0) setUnlocked(steps[current - 1]?.key || null);
    localStorage.setItem(storageKey, String(current));
  }, [steps, submissionId]);

  return (
    <section className="workspace-card workspace-journey">
      <div className="workspace-head">
        <div><span>Рабочая зона</span><h2>{status}</h2></div>
        <Link className="btn btn-small" href="/chats">Все чаты</Link>
      </div>
      <div className="journey-rail">
        {steps.map((step, index) => {
          const Icon = ICONS[step.key as keyof typeof ICONS] || LockKeyhole;
          const locked = !step.done && !step.active;
          return (
            <div className={`journey-step ${step.done ? "done" : step.active ? "active" : "locked"} ${unlocked === step.key ? "just-unlocked" : ""}`} key={step.key}>
              {index ? <span className="journey-arrow" aria-hidden="true">→</span> : null}
              <div className="journey-icon">
                {locked ? <LockKeyhole size={19} /> : step.done ? <Check size={20} /> : <Icon size={20} />}
                {unlocked === step.key ? <i className="lock-shards" aria-hidden="true" /> : null}
              </div>
              <div className="journey-copy">
                <b>{step.title}</b>
                <small>{step.detail}</small>
                {step.metric ? <em className="journey-metric">{step.metric}</em> : null}
              </div>
              {step.active && step.href ? <Link className="journey-cta" href={step.href}>Продолжить</Link> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
