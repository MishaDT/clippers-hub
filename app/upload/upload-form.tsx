"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Check, CheckCircle2, ChevronDown, Clock3, Copy, Download,
  Eye, FileCheck2, Link2, RotateCcw, Send, ShieldCheck, WalletCards
} from "lucide-react";
import { submitClipAction, submitDraftAction } from "@/app/actions";
import styles from "./upload-form.module.css";
import { upload } from "@vercel/blob/client";
import { MetaProductsNotice } from "@/components/meta-products-notice";

type Order = {
  id: string;
  campaignId: string;
  title: string;
  trackingCode: string;
  payout: string;
  guarantee: string | null;
  target: string;
  daysLeft: number;
  platforms: string[];
  watermarkRequired: boolean;
  strictVerification: boolean;
  visualProofConfirmed: boolean;
  socialAccounts: Array<{ id: string; platform: string; handle: string }>;
  requiredTags: string[];
  draftRequired: boolean;
  draftStatus: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  draftRevision: number;
  maxRevisionRounds: number;
  reviewMode: "FAST" | "STANDARD" | "STRICT";
  draftReviewNote: string | null;
  draftUrl: string | null;
  publicationReady: boolean;
  adMarking: string | null;
};

const labels: Record<string, string> = {
  TIKTOK: "TikTok", YOUTUBE: "YouTube", INSTAGRAM: "Instagram*", VK: "VK"
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

export function UploadForm({ orders, blobEnabled }: { orders: Order[]; blobEnabled: boolean }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id || "");
  const [postUrl, setPostUrl] = useState("");
  const [socialAccountId, setSocialAccountId] = useState("__auto__");
  const [draftUrl, setDraftUrl] = useState(orders[0]?.draftUrl || "");
  const [workerNote, setWorkerNote] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [uploadingDraft, setUploadingDraft] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const selectRef = useRef<HTMLDivElement>(null);
  const selected = orders.find((order) => order.id === selectedId) || orders[0];
  const platform = inspectUrl(postUrl);
  const matchingSocialAccounts = selected?.socialAccounts.filter((account) => account.platform === platform) || [];
  const effectiveSocialAccountId = socialAccountId === ""
    ? ""
    : matchingSocialAccounts.some((account) => account.id === socialAccountId)
      ? socialAccountId
      : matchingSocialAccounts[0]?.id || "";
  const canPublish = Boolean(selected?.publicationReady)
    && (!selected?.draftRequired || selected.draftStatus === "APPROVED")
    && (!selected?.strictVerification || selected.visualProofConfirmed);
  const canSubmitDraft = Boolean(
    selected?.draftRequired
    && ["NOT_SUBMITTED", "CHANGES_REQUESTED"].includes(selected.draftStatus)
    && /^https:\/\//i.test(draftUrl)
  );
  const description = selected
    ? [selected.adMarking, selected.trackingCode, selected.requiredTags.join(" ")].filter(Boolean).join("\n\n")
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
    setDraftUrl(order.draftUrl || "");
    setWorkerNote("");
    setUploadError("");
    setPostUrl("");
    setSocialAccountId("__auto__");
    setOpen(false);
  };

  const copyDescription = async () => {
    await navigator.clipboard.writeText(description);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const uploadDraftFile = async (file: File | null) => {
    if (!file || !selected) return;
    setUploadError("");
    if (file.size > 500 * 1024 * 1024) {
      setUploadError("Файл больше 500 МБ. Сожмите видео или используйте HTTPS-ссылку.");
      return;
    }
    setUploadingDraft(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "draft.mp4";
      const blob = await upload(`drafts/${selected.id}/${Date.now()}-${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/draft",
        clientPayload: JSON.stringify({ submissionId: selected.id }),
        multipart: true
      });
      setDraftUrl(blob.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Не удалось загрузить видео");
    } finally {
      setUploadingDraft(false);
    }
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

          {selected.draftRequired ? (
            <section className={`up-step ${styles.draftStep}`} data-status={selected.draftStatus.toLowerCase()}>
              <div className="up-step-head">
                <span className="up-step-no">2</span>
                <h2>Отправьте черновик до публикации</h2>
              </div>
              <div className={styles.draftStatus}>
                <FileCheck2 size={18} />
                <div>
                  <b>
                    {selected.draftStatus === "APPROVED"
                      ? "Черновик принят — можно публиковать"
                      : selected.draftStatus === "PENDING"
                        ? "Черновик проверяется"
                        : selected.draftStatus === "CHANGES_REQUESTED"
                          ? "Нужны изменения"
                          : selected.draftStatus === "REJECTED"
                            ? "Черновик отклонён"
                            : "Черновик ещё не отправлен"}
                  </b>
                  <span>
                    Режим: {selected.reviewMode === "FAST" ? "быстрый" : selected.reviewMode === "STRICT" ? "строгий" : "стандартный"}
                    {" · "}версия {selected.draftRevision + 1}
                    {" · "}до {selected.maxRevisionRounds} кругов правок
                  </span>
                </div>
              </div>
              {selected.draftReviewNote ? <p className={styles.draftNote}>{selected.draftReviewNote}</p> : null}
              {["NOT_SUBMITTED", "CHANGES_REQUESTED"].includes(selected.draftStatus) ? (
                <div className={styles.draftFields}>
                  {blobEnabled ? (
                    <label className={styles.fileUpload}>
                      <span>Загрузить видео напрямую</span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        disabled={uploadingDraft}
                        onChange={(event) => void uploadDraftFile(event.target.files?.[0] || null)}
                      />
                      <small>{uploadingDraft ? "Загружаем файл…" : "MP4, MOV или WebM, до 500 МБ"}</small>
                    </label>
                  ) : null}
                  {uploadError ? <p className={styles.uploadError}>{uploadError}</p> : null}
                  <label>
                    <span>Закрытая HTTPS-ссылка на видео</span>
                    <input
                      name="draftUrl"
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      placeholder="https://drive.google.com/... или https://youtu.be/..."
                      value={draftUrl}
                      onChange={(event) => setDraftUrl(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Комментарий проверяющему</span>
                    <textarea
                      name="workerNote"
                      maxLength={500}
                      value={workerNote}
                      onChange={(event) => setWorkerNote(event.target.value)}
                      placeholder="Что изменено или на что обратить внимание"
                    />
                  </label>
                  <button
                    className={`btn ${styles.draftSubmit}`}
                    type="submit"
                    formAction={submitDraftAction}
                    formNoValidate
                    disabled={!canSubmitDraft || uploadingDraft}
                  >
                    {selected.draftStatus === "CHANGES_REQUESTED" ? <RotateCcw size={17} /> : <Send size={17} />}
                    {selected.draftStatus === "CHANGES_REQUESTED" ? "Отправить исправленную версию" : "Отправить черновик"}
                  </button>
                  <small>Ссылка должна открываться проверяющему без запроса пароля.</small>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="up-step">
            <div className="up-step-head"><span className="up-step-no">{selected.draftRequired ? "3" : "2"}</span><h2>Опубликуйте ролик</h2></div>
            <p className="up-step-desc">Скопируйте готовое описание. Код заказа и обязательные теги уже добавлены.</p>
            <div className="up-desc">
              <div className="up-desc-head">
                <span><ShieldCheck size={14} /> Описание для публикации</span>
                <button type="button" className={`up-copy${copied ? " is-copied" : ""}`} onClick={copyDescription} disabled={!selected.publicationReady}>
                  {copied ? <><Check size={15} /> Скопировано</> : <><Copy size={15} /> Копировать</>}
                </button>
              </div>
              <pre className="up-desc-pre">{description}</pre>
            </div>
            {!selected.publicationReady ? (
              <div className={styles.connectionSummary} data-connected="false">
                <ShieldCheck size={17} />
                <span>Заказ закреплён за вами, но ERID ещё готовится. Делать и согласовывать ролик можно; публиковать пока нельзя.</span>
                <a href={`/campaigns/${selected.campaignId}`}>Статус заказа</a>
              </div>
            ) : null}
            <div className="up-materials">
              <div className="up-material">
                <div className="up-material-ico"><Image src="/watermark/reelpay-watermark.svg" alt="" width={56} height={56} /></div>
                <div className="up-material-body">
                  <strong>{selected.strictVerification ? "Уникальный QR ReelPay обязателен" : `Watermark ReelPay ${selected.watermarkRequired ? "обязателен" : "по желанию"}`}</strong>
                  <span>{selected.strictVerification ? "Этот QR подписан для конкретной работы и не подходит к другому заказу." : "Поместите в угол ролика: 12–18% ширины, прозрачность 80–90%."}</span>
                </div>
                <span className="up-material-downloads">
                  <a href={selected.strictVerification ? `/api/submissions/${selected.id}/visual-key?format=png` : "/watermark/reelpay-watermark.png"} download><Download size={15} /> PNG</a>
                  <a href={selected.strictVerification ? `/api/submissions/${selected.id}/visual-key?format=svg` : "/watermark/reelpay-watermark.svg"} download><Download size={15} /> SVG</a>
                </span>
              </div>
            </div>
          </section>

          <section className="up-step">
            <div className="up-step-head"><span className="up-step-no">3</span><h2>Вставьте ссылку на ролик</h2></div>
            <div className={styles.connectionSummary} data-connected={selected.socialAccounts.length > 0}>
              {selected.socialAccounts.length ? <CheckCircle2 size={17} /> : <Link2 size={17} />}
              <span>{selected.socialAccounts.length
                ? `Подключено: ${selected.socialAccounts.map((account) => `${labels[account.platform] || account.platform} @${account.handle.replace(/^@/, "")}`).join(" · ")}`
                : "Соцсети пока не подключены — автоматическая проверка будет недоступна."}</span>
              <a href="/settings/account#social-accounts">{selected.socialAccounts.length ? "Управлять" : "Подключить"}</a>
            </div>
            <div className={`up-url${platform ? " ok" : ""}`}>
              <Link2 size={18} />
              <input name="postUrl" type="url" inputMode="url" autoComplete="off" placeholder="https://youtube.com/shorts/..." value={postUrl} onChange={(event) => setPostUrl(event.target.value)} required disabled={!canPublish} />
              {platform ? <CheckCircle2 size={18} color="#22c55e" /> : null}
            </div>
            <small className="up-hint">{!selected.publicationReady ? "Ссылка станет доступна после получения ERID." : !canPublish ? selected.strictVerification && !selected.visualProofConfirmed ? "Ссылка станет доступна после проверки индивидуального QR на черновике." : "Ссылка станет доступна после принятия черновика." : platform ? `Площадка: ${labels[platform]}` : "Разрешены HTTPS-ссылки TikTok, YouTube, Instagram* и VK"}</small>
            {platform === "INSTAGRAM" ? <MetaProductsNotice compact /> : null}
            {platform && matchingSocialAccounts.length ? (
              <div className={styles.accountConnect} data-connected="true">
              <CheckCircle2 size={19} />
              <label className="field">
                Проверить через подключённый аккаунт
                <select name="socialAccountId" value={effectiveSocialAccountId} onChange={(event) => setSocialAccountId(event.target.value)}>
                  {matchingSocialAccounts.map((account) => (
                    <option key={account.id} value={account.id}>@{account.handle}</option>
                  ))}
                  <option value="">Без привязки — по коду в описании</option>
                </select>
              </label>
              <small>Аккаунт выбран автоматически. Код в описании можно оставить как дополнительное подтверждение.</small>
              </div>
            ) : platform ? (
              <div className={styles.accountConnect}>
                <Link2 size={19} />
                <div><b>Аккаунт {labels[platform]} не подключён</b><span>Можно сдать по коду в описании или один раз подключить площадку для автоматической проверки.</span></div>
                <a className="btn btn-small" href="/settings/account#social-accounts">Подключить площадку</a>
                <input type="hidden" name="socialAccountId" value="" />
              </div>
            ) : <input type="hidden" name="socialAccountId" value="" />}
          </section>

          <label className="up-confirm">
            <input type="checkbox" name="watermarkConfirmed" required={selected.watermarkRequired} disabled={!canPublish} />
            <span>Ролик опубликован с готовым описанием{selected.watermarkRequired ? " и watermark ReelPay" : ""}.</span>
          </label>
          <button className="btn btn-primary up-submit" type="submit" disabled={!platform || !canPublish}><Send size={18} /> Отправить на проверку</button>
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
          <p className="up-summary-note"><ShieldCheck size={14} /> {selected.guarantee
            ? `После проверки гарантировано минимум ${selected.guarantee} чистыми; просмотры могут увеличить выплату.`
            : "Выплата начисляется после проверки просмотров и кода заказа."}</p>
        </aside>
      </div>
    </form>
  );
}
