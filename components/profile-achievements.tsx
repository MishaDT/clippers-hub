"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Film, Flame, Lock, Megaphone, Play, Scissors, Sparkles, Star, Trophy, Users } from "lucide-react";
import { claimAchievementAction } from "@/app/actions";

const ICONS: Record<string, typeof Sparkles> = {
  play: Play, star: Star, scissors: Scissors, flame: Flame, trophy: Trophy, users: Users, megaphone: Megaphone, film: Film
};

type Item = {
  code: string;
  title: string;
  description: string;
  icon: string;
  reward: number;
  target: number;
  value: number;
  pct: number;
  done: boolean;
  claimed: boolean;
};

export function ProfileAchievements({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const claim = (code: string) => {
    setBusy(code);
    startTransition(async () => {
      const data = new FormData();
      data.set("code", code);
      await claimAchievementAction(data);
      setBusy(null);
      router.refresh();
    });
  };

  return (
    <div className="ach-grid">
      {items.map((item) => {
        const Icon = ICONS[item.icon] || Sparkles;
        const claimable = item.done && !item.claimed;
        return (
          <div className={`ach-card ${item.claimed ? "is-claimed" : item.done ? "is-ready" : ""}`} key={item.code}>
            <span className="ach-card-ico"><Icon size={20} /></span>
            <div className="ach-card-body">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
              {!item.done ? <div className="ach-card-bar"><i style={{ width: `${item.pct}%` }} /></div> : null}
            </div>
            <div className="ach-card-side">
              <b className="ach-reward">+{item.reward} RP</b>
              {item.claimed ? (
                <span className="ach-state done"><Check size={14} /> Получено</span>
              ) : claimable ? (
                <button className="ach-claim" type="button" onClick={() => claim(item.code)} disabled={pending && busy === item.code}>
                  {pending && busy === item.code ? "..." : "Забрать"}
                </button>
              ) : (
                <span className="ach-state"><Lock size={12} /> {item.pct}%</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
