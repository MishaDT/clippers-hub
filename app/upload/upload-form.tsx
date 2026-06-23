"use client";

import { useState } from "react";
import { CheckCircle2, Link2, Send, ShieldCheck } from "lucide-react";
import { submitClipAction } from "@/app/actions";

type Order = { id: string; title: string; trackingCode: string; payout: string };

const platformLabel: Record<string, string> = { TIKTOK: "TikTok", YOUTUBE: "YouTube", INSTAGRAM: "Instagram", VK: "VK" };

function detectPlatform(url: string) {
  const u = url.toLowerCase();
  if (u.includes("tiktok")) return "TIKTOK";
  if (u.includes("youtu")) return "YOUTUBE";
  if (u.includes("instagram")) return "INSTAGRAM";
  if (u.includes("vk.")) return "VK";
  return "TIKTOK";
}

export function UploadForm({ orders }: { orders: Order[] }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id || "");
  const [postUrl, setPostUrl] = useState("");
  const selected = orders.find((o) => o.id === selectedId) || orders[0];
  const platform = detectPlatform(postUrl);
  const valid = /^https?:\/\/.+\..+/.test(postUrl.trim());

  return (
    <form className="upload-form-v2" action={submitClipAction}>
      <input type="hidden" name="platform" value={platform} />

      <div className="uf-field">
        <label className="uf-label" htmlFor="uf-order">Какой заказ сдаёшь</label>
        <select id="uf-order" name="submissionId" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>{o.title}</option>
          ))}
        </select>
        {selected ? <small className="uf-hint">Оплата до {selected.payout} · код {selected.trackingCode}</small> : null}
      </div>

      <div className="uf-field">
        <label className="uf-label" htmlFor="uf-url">Ссылка на опубликованный ролик</label>
        <div className={`uf-input${valid ? " ok" : ""}`}>
          <Link2 size={18} />
          <input
            id="uf-url"
            name="postUrl"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.tiktok.com/@.../video/..."
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            required
          />
          {valid ? <CheckCircle2 size={18} color="#22c55e" /> : null}
        </div>
        <small className="uf-hint">{valid ? `Площадка: ${platformLabel[platform]}` : "TikTok, YouTube Shorts, Reels или VK Clips"}</small>
      </div>

      <div className="uf-note">
        <ShieldCheck size={18} />
        <span>После отправки мы начнём считать просмотры. Оплата — после проверки и базового антифрода.</span>
      </div>

      <button className="btn btn-primary uf-submit" type="submit" disabled={!valid}>
        <Send size={20} /> Отправить на проверку
      </button>
    </form>
  );
}
