"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, Share2 } from "lucide-react";

export function ReferralShare({ link, qrDataUrl }: { link: string; qrDataUrl: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "ReelPay", text: "Присоединяйся к ReelPay", url: link });
        return;
      } catch {}
    }
    await copy();
  }
  return (
    <div className="ref-share">
      <div className="ref-share-main">
        <span>{link}</span>
        <button type="button" onClick={copy} aria-label="Скопировать реферальную ссылку">{copied ? <Check size={18} /> : <Copy size={18} />}</button>
      </div>
      <button className="btn btn-primary" type="button" onClick={share}><Share2 size={17} /> Поделиться</button>
      <Image src={qrDataUrl} alt="QR-код реферальной ссылки" width={152} height={152} unoptimized />
    </div>
  );
}
