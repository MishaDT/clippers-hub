"use client";

import { useState } from "react";
import { Check, Copy, Share2, Users } from "lucide-react";

export function ReferralCard({ code, invited, rewardRp }: { code: string; invited: number; rewardRp: number }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/register?ref=${code}` : `/register?ref=${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "ReelPay", text: "Залетай на ReelPay — биржа коротких видео", url: link });
        return;
      } catch {
        /* user cancelled — fall back to copy */
      }
    }
    copy();
  }

  return (
    <div className="referral">
      <div className="referral-head">
        <Users size={16} /> <b>Пригласи друга</b>
      </div>
      <p><b>+25 RP</b> за каждого друга после регистрации. За 3 друзей откроется дополнительное достижение.</p>

      <div className="referral-link">
        <span>{code}</span>
        <button type="button" onClick={copy} aria-label="Скопировать ссылку">
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>

      <button className="btn btn-primary referral-share" type="button" onClick={share}>
        <Share2 size={16} /> Пригласить на платформу
      </button>

      <div className="referral-stat">
        <span><b>{invited}</b> зарегистрировано</span>
        <span><b>{rewardRp} RP</b> получено</span>
      </div>
    </div>
  );
}
