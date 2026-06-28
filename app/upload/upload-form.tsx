"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check, CheckCircle2, ChevronDown, Clock3, Copy, Download,
  Eye, Link2, Send, ShieldCheck, WalletCards
} from "lucide-react";
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

const labels: Record<string, string> = {
  TIKTOK: "TikTok", YOUTUBE: "YouTube", INSTAGRAM: "Instagram", VK: "VK"
};

function inspectUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:") return null;
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TIKTOK";
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "YOUTUBE";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "INSTAGRAM";
    if (host === "vk.com" || host.endsWith(".vk.com")) return "VK";
  } catch {}
  return null;
}

export function UploadForm({ orders }: { orders: Order[] }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id || "");
  const [postUrl, setPostUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const selected = orders.find((order) => order.id === selectedId) || orders[0];
  const platform = inspectUrl(postUrl);
  const description = selected
    ? [selected.trackingCode, selected.requiredTags.join(" ")].filter(Boolean).join("\n\n")
    : "";

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (index: number) => {
    const order = orders[index];
    if (!order) return;
    setSelectedId(order.id);
    setActiveIndex(index);
    setOpen(false);
  };

  const copyDescription = async () => {
    await navigator.clipboard.writeText(description);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (!selected) return <p className="up-empty">Сначала возьмите заказ, затем вернитесь к сдаче работы.</p>;

  return (
    <form className="up" action={submitClipAction}>
      <input type="hidden" name="platform" value={platform || ""} />
      <input type="hidden" name="submissionId" value={selectedId} />
      <div className="up-grid">
        <div className="up-steps">
          <section className="up-step">
            <div className="up-step-head"><span className="up-step-no">1</span><h2>Выберите заказ</h2></div>
            <div className="up-select-wrap" ref={selectRef}>
              <button
                type="button"
                className="up-select-btn"
                data-open={open}
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={() => setOpen((value) => !value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                  if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((activeIndex + 1) % orders.length); }
                  if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((activeIndex - 1 + orders.length) % orders.length); }
                  if (event.key === "Enter" && open) { event.preventDefault(); choose(activeIndex); }
                }}
              >
                <span>{selected.title}</span><ChevronDown size={18} />
              </button>
              {open ? <div className="up-select-list" role="listbox">
                {orders.map((order, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={order.id === selectedId}
                    key={order.id}
                    className={`up-select-opt${index === activeIndex ? " is-active" : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                  >
                    <span className="up-select-opt-title">{order.title}</span>
                    <span className="up-select-opt-pay">до {order.payout}</span>
                  </button>
                ))}
              </div> : null}
            </div>
          </section>

          <section className="up-step">
            <div className="up-step-head"><span className="up-step-no">2</span><h2>Опубликуйте ролик</h2></div>
            <p className="up-step-desc">Скопируйте готовое описание. Код заказа и обязательные теги уже добавлены.</p>
            <div className="up-desc">
              <div className="up-desc-head">
                <span><ShieldCheck size={14} /> Описание для публикации</span>
                <button type="button" className={`up-copy${copied ? " is-copied" : ""}`} onClick={copyDescription}>
                  {copied ? <><Check size={15} /> Скопировано</> : <><Copy size={15} /> Копировать</>}
                </button>
              </div>
              <pre className="up-desc-pre">{description}</pre>
            </div>
            <div className="up-materials">
              <div className="up-material">
                <div className="up-material-ico"><img src="/watermark/reelpay-watermark.svg" alt="" /></div>
                <div className="up-material-body">
                  <strong>Watermark ReelPay {selected.watermarkRequired ? "обязателен" : "по желанию"}</strong>
                  <span>Поместите в угол ролика: 12–18% ширины, прозрачность 80–90%.</span>
                </div>
                <span className="up-material-downloads">
                  <a href="/watermark/reelpay-watermark.png" download><Download size={15} /> PNG</a>
                  <a href="/watermark/reelpay-watermark.svg" download><Download size={15} /> SVG</a>
                </span>
              </div>
            </div>
          </section>

          <section className="up-step">
            <div className="up-step-head"><span className="up-step-no">3</span><h2>Вставьте ссылку на ролик</h2></div>
            <div className={`up-url${platform ? " ok" : ""}`}>
              <Link2 size={18} />
              <input name="postUrl" type="url" inputMode="url" autoComplete="off" placeholder="https://youtube.com/shorts/..." value={postUrl} onChange={(event) => setPostUrl(event.target.value)} required />
              {platform ? <CheckCircle2 size={18} color="#22c55e" /> : null}
            </div>
            <small className="up-hint">{platform ? `Площадка: ${labels[platform]}` : "Разрешены HTTPS-ссылки TikTok, YouTube, Instagram и VK"}</small>
          </section>

          <label className="up-confirm">
            <input type="checkbox" name="watermarkConfirmed" required={selected.watermarkRequired} />
            <span>Ролик опубликован с готовым описанием{selected.watermarkRequired ? " и watermark ReelPay" : ""}.</span>
          </label>
          <button className="btn btn-primary up-submit" type="submit" disabled={!platform}><Send size={18} /> Отправить на проверку</button>
        </div>

        <aside className="up-summary">
          <span className="up-summary-label">Сдаёте заказ</span>
          <strong className="up-summary-title">{selected.title}</strong>
          <div className="up-summary-pay"><span className="up-summary-pay-ico"><WalletCards size={16} /></span><div><b>до {selected.payout}</b><em>за результат</em></div></div>
          <div className="up-summary-metrics">
            <div><Eye size={15} /><b>{selected.target}</b><em>цель</em></div>
            <div><Clock3 size={15} /><b>{selected.daysLeft} дн.</b><em>до дедлайна</em></div>
          </div>
          <div className="up-summary-plats"><span>Площадки</span><div>{selected.platforms.map((item) => <i key={item}>{item}</i>)}</div></div>
          <p className="up-summary-note"><ShieldCheck size={14} /> Выплата начисляется после проверки просмотров и кода заказа.</p>
        </aside>
      </div>
    </form>
  );
}
