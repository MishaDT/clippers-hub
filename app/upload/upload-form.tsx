"use client";

import { useState } from "react";
import { Check, CheckCircle2, Clock3, Copy, Download, Eye, Link2, Send, ShieldCheck, WalletCards } from "lucide-react";
import { submitClipAction } from "@/app/actions";

type Order = {
  id: string;
  title: string;
  trackingCode: string;
  payout: string;
  target: string;
  daysLeft: number;
  platforms: string[];
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
  const [copied, setCopied] = useState(false);
  const selected = orders.find((order) => order.id === selectedId) || orders[0];
  const platform = detectPlatform(postUrl);
  const valid = /^https:\/\/.+\..+/.test(postUrl.trim());

  const copyCode = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.trackingCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <form className="up" action={submitClipAction}>
      <input type="hidden" name="platform" value={platform} />

      <div className="up-grid">
        <div className="up-steps">
          {/* Step 1 — choose order */}
          <section className="up-step">
            <div className="up-step-head"><span className="up-step-no">1</span><h2>Выбери заказ</h2></div>
            <select className="up-select" name="submissionId" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>{order.title}</option>
              ))}
            </select>
          </section>

          {/* Step 2 — publish with code */}
          <section className="up-step">
            <div className="up-step-head"><span className="up-step-no">2</span><h2>Опубликуй ролик с кодом</h2></div>
            <p className="up-step-desc">
              Добавь этот код в описание ролика. Система проверит его через API площадки и подтвердит, что публикация твоя — без кода выплата не начисляется.
            </p>
            <div className="up-code">
              <code>{selected?.trackingCode}</code>
              <button type="button" className={`up-copy${copied ? " is-copied" : ""}`} onClick={copyCode}>
                {copied ? <><Check size={15} /> Скопировано</> : <><Copy size={15} /> Копировать</>}
              </button>
            </div>

            {selected?.requiredTags.length ? (
              <div className="up-tags">
                <span className="up-tags-label">Обязательные теги</span>
                {selected.requiredTags.map((tag) => <span className="up-tag" key={tag}>{tag}</span>)}
              </div>
            ) : null}

            {selected?.watermarkRequired ? (
              <div className="up-watermark">
                <div className="up-watermark-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/watermark/reelpay-watermark.svg" alt="ReelPay" />
                </div>
                <div className="up-watermark-body">
                  <strong>Логотип ReelPay обязателен</strong>
                  <span>Добавь в CapCut поверх видео: нижний правый угол, 12–18% ширины, прозрачность 80–90%.</span>
                  <a className="btn btn-small" href="/watermark/reelpay-watermark.svg" download><Download size={15} /> Скачать SVG</a>
                </div>
              </div>
            ) : null}
          </section>

          {/* Step 3 — paste link */}
          <section className="up-step">
            <div className="up-step-head"><span className="up-step-no">3</span><h2>Вставь ссылку на ролик</h2></div>
            <div className={`up-url${valid ? " ok" : ""}`}>
              <Link2 size={18} />
              <input
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
            <small className="up-hint">{valid ? `Площадка: ${platformLabel[platform]}` : "Только HTTPS: TikTok, YouTube Shorts, Reels или VK Clips"}</small>
          </section>

          <label className="up-confirm">
            <input type="checkbox" name="watermarkConfirmed" required={Boolean(selected?.watermarkRequired)} />
            <span>{selected?.watermarkRequired ? "Я добавил логотип ReelPay и код заказа в описание ролика" : "Я добавил код заказа в описание ролика"}</span>
          </label>

          <button className="btn btn-primary up-submit" type="submit"><Send size={18} /> Отправить на проверку</button>
        </div>

        {/* Order summary */}
        <aside className="up-summary">
          <span className="up-summary-label">Сдаёшь заказ</span>
          <strong className="up-summary-title">{selected?.title}</strong>
          <div className="up-summary-pay">
            <span className="up-summary-pay-ico"><WalletCards size={16} /></span>
            <div><b>до {selected?.payout}</b><em>за результат</em></div>
          </div>
          <div className="up-summary-metrics">
            <div><Eye size={15} /><b>{selected?.target}</b><em>цель</em></div>
            <div><Clock3 size={15} /><b>{selected?.daysLeft} дн</b><em>до дедлайна</em></div>
          </div>
          {selected?.platforms.length ? (
            <div className="up-summary-plats">
              <span>Площадки</span>
              <div>{selected.platforms.map((p) => <i key={p}>{p}</i>)}</div>
            </div>
          ) : null}
          <p className="up-summary-note"><ShieldCheck size={14} /> Выплата начисляется после проверки просмотров и кода заказа.</p>
        </aside>
      </div>
    </form>
  );
}
