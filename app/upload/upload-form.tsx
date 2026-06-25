"use client";

import { useState } from "react";
import { CheckCircle2, Download, Link2, Send, ShieldCheck } from "lucide-react";
import { submitClipAction } from "@/app/actions";

type Order = {
  id: string;
  title: string;
  trackingCode: string;
  payout: string;
  watermarkRequired: boolean;
  requiredTags: string[];
};

const platformLabel: Record<string, string> = { TIKTOK: "TikTok", YOUTUBE: "YouTube", INSTAGRAM: "Instagram", VK: "VK" };

function detectPlatform(url: string) {
  const value = url.toLowerCase();
  if (value.includes("tiktok")) return "TIKTOK";
  if (value.includes("youtu")) return "YOUTUBE";
  if (value.includes("instagram")) return "INSTAGRAM";
  if (value.includes("vk.")) return "VK";
  return "TIKTOK";
}

export function UploadForm({ orders }: { orders: Order[] }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id || "");
  const [postUrl, setPostUrl] = useState("");
  const selected = orders.find((order) => order.id === selectedId) || orders[0];
  const platform = detectPlatform(postUrl);
  const valid = /^https:\/\/.+\..+/.test(postUrl.trim());

  return (
    <form className="upload-form-v2" action={submitClipAction}>
      <input type="hidden" name="platform" value={platform} />

      <div className="uf-field">
        <label className="uf-label" htmlFor="uf-order">Какой заказ сдаешь</label>
        <select id="uf-order" name="submissionId" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>{order.title}</option>
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
            onChange={(event) => setPostUrl(event.target.value)}
            required
          />
          {valid ? <CheckCircle2 size={18} color="#22c55e" /> : null}
        </div>
        <small className="uf-hint">{valid ? `Площадка: ${platformLabel[platform]}` : "Только HTTPS: TikTok, YouTube Shorts, Reels или VK Clips"}</small>
      </div>

      <div className="uf-note">
        <ShieldCheck size={18} />
        <span>Добавь код <b>{selected?.trackingCode}</b> в описание ролика. Мы проверяем его через API площадки — без кода в описании выплата не начисляется (так подтверждается, что клип твой).</span>
      </div>

      {selected?.requiredTags.length ? (
        <div className="uf-tags">
          {selected.requiredTags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      ) : null}

      {selected?.watermarkRequired ? (
        <div className="watermark-kit">
          <div className="watermark-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/watermark/reelpay-watermark.svg" alt="ReelPay watermark" />
          </div>
          <div>
            <strong>Watermark ReelPay</strong>
            <span>Скачай SVG, добавь в CapCut поверх видео: нижний правый угол, 12-18% ширины, прозрачность 80-90%.</span>
            <a className="btn" href="/watermark/reelpay-watermark.svg" download><Download size={16} /> Скачать watermark</a>
          </div>
        </div>
      ) : null}

      <label className="uf-checkbox">
        <input type="checkbox" name="watermarkConfirmed" required={Boolean(selected?.watermarkRequired)} />
        <span>{selected?.watermarkRequired ? "Я добавил watermark ReelPay и tracking-code в описание" : "Я добавил tracking-code в описание ролика"}</span>
      </label>

      <button className="btn btn-primary uf-submit" type="submit" disabled={!valid}>
        <Send size={20} /> Отправить на проверку
      </button>
    </form>
  );
}
