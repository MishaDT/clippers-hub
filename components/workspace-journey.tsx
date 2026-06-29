"use client";

import Link from "next/link";
import { Check, Eye, Heart, Link2, LockKeyhole, Radar, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

type JourneyStep = {
  key: string;
  title: string;
  done: boolean;
  active: boolean;
  detail: string;
  href?: string;
};

const ICONS = { accepted: Check, link: Link2, tracking: Radar, payout: WalletCards };

export function WorkspaceJourney({
  submissionId,
  status,
  steps,
  views,
  likes,
  fraudScore,
  watermark
}: {
  submissionId: string;
  status: string;
  steps: JourneyStep[];
  views: string;
  likes: string;
  fraudScore: number;
  watermark: string;
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
              <div className="journey-copy"><b>{step.title}</b><small>{step.detail}</small></div>
              {step.active && step.href ? <Link className="journey-cta" href={step.href}>Продолжить</Link> : null}
            </div>
          );
        })}
      </div>
      <div className="journey-metrics">
        <span><Eye size={16} /><b>{views}</b><small>{views === "0" ? "Трекинг начнётся после ссылки" : "просмотров"}</small></span>
        <span><Heart size={16} /><b>{likes}</b><small>{likes === "0" ? "Появятся после синхронизации" : "лайков"}</small></span>
        <span><ShieldCheck size={16} /><b>{fraudScore}%</b><small>{fraudScore ? "риск проверки" : "Нарушений не найдено"}</small></span>
        <span><Radar size={16} /><b>{watermark}</b><small>{watermark === "Не запускалась" ? "После отправки ссылки" : "watermark"}</small></span>
      </div>
    </section>
  );
}
