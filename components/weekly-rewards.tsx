"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { claimRecurringRewardAction } from "@/app/actions";

type Reward = {
  code: string;
  title: string;
  reward: number;
  target: number;
  value: number;
  claimed: boolean;
};

export function WeeklyRewards({ items }: { items: Reward[] }) {
  const [rewards, setRewards] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function claim(code: string) {
    setBusy(code);
    setMessage("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("code", code);
      const result = await claimRecurringRewardAction(formData);
      if (!result.ok) {
        setMessage(result.error || "Не удалось получить награду");
      } else {
        setRewards((current) => current.map((item) => item.code === code ? { ...item, claimed: true } : item));
        window.dispatchEvent(new CustomEvent("rp-balance", { detail: result.rpBalance }));
        setMessage(result.rewardRp ? `Начислено ${result.rewardRp} RP` : "Награда уже получена");
      }
      setBusy(null);
    });
  }

  return (
    <div className="weekly-rewards">
      {rewards.map((reward) => {
        const done = reward.value >= reward.target;
        return (
          <div className="weekly-reward-row" key={reward.code}>
            <span><b>{reward.title}</b><small>{Math.min(reward.value, reward.target).toLocaleString("ru-RU")} / {reward.target.toLocaleString("ru-RU")}</small></span>
            <em>+{reward.reward} RP</em>
            <button className="btn btn-small" type="button" disabled={!done || reward.claimed || (pending && busy === reward.code)} onClick={() => claim(reward.code)}>
              {pending && busy === reward.code ? <LoaderCircle className="spin" size={15} /> : reward.claimed ? <><Check size={15} /> Получено</> : done ? "Забрать" : "В процессе"}
            </button>
          </div>
        );
      })}
      {message ? <p className="reward-live-message" role="status">{message}</p> : null}
    </div>
  );
}
