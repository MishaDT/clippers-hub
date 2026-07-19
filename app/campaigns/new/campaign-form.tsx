"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  Hash,
  Link2,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  WalletCards
} from "lucide-react";
import { createCampaignAction } from "@/app/actions";
import { MetaProductsNotice } from "@/components/meta-products-notice";
import { compactNumber, grossPayout, rub } from "@/lib/money";
import styles from "./campaign-form.module.css";

const platformOptions = [
  ["TIKTOK", "TikTok"],
  ["YOUTUBE", "Shorts"],
  ["VK", "VK Clips"]
] as const;

const viewOptions = [5000, 10000, 25000, 50000] as const;
const deadlineOptions = [3, 5, 7, 10, 14, 30] as const;
const DRAFT_KEY = "reelpay_campaign_draft_v1";
const steps = ["Задача", "Исходник", "Результат", "Площадки", "Правила", "Бюджет", "Проверка"] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="order-submit" type="submit" disabled={pending}>
      {pending ? "Публикуем..." : "Опубликовать заказ"} <ArrowRight size={18} />
    </button>
  );
}

function CampaignForecast({
  payout,
  guarantee,
  viewThreshold,
  cpm,
  budget,
  grossViews,
  deadlineDays,
  deliverableCount,
  requiredBudget,
  quality,
  showSubmit = false
}: {
  payout: number;
  guarantee: number;
  viewThreshold: number;
  cpm: number;
  budget: number;
  grossViews: number;
  deadlineDays: number;
  deliverableCount: number;
  requiredBudget: number;
  quality: string;
  showSubmit?: boolean;
}) {
  const coverage = requiredBudget > 0 ? Math.min(100, Math.round((budget / requiredBudget) * 100)) : 100;
  const enough = budget >= requiredBudget;

  return (
    <>
      <header className="summary-head">
        <h2>{rub(payout)}</h2>
        <p>максимум за один ролик при выполненной цели</p>
      </header>

      <div className="summary-equation" aria-label="Формула максимальной выплаты">
        <span><b>{compactNumber(viewThreshold)}</b><small>просмотров</small></span>
        <i>×</i>
        <span><b>{rub(cpm * 100)}</b><small>за 1000</small></span>
        <i>=</i>
        <strong>{rub(payout)}</strong>
      </div>

      <div className="summary-guarantee">
        <ShieldCheck size={17} />
        <span><b>Гарантия {rub(guarantee)}</b><small>за проверенный ролик к дедлайну</small></span>
      </div>

      <div className="summary-strip">
        <span><WalletCards size={16} /><b>{rub(budget * 100)}</b><small>общий бюджет</small></span>
        <span><MonitorPlay size={16} /><b>{compactNumber(grossViews)}</b><small>потенциал</small></span>
        <span><CalendarDays size={16} /><b>{deadlineDays} дн.</b><small>срок</small></span>
      </div>

      <div className="summary-capacity">
        <div><b>{quality}</b><span>{enough ? `${deliverableCount} результата покрыты бюджетом` : `Для ${deliverableCount} результатов нужно ${requiredBudget.toLocaleString("ru-RU")} ₽`}</span></div>
        <div className="summary-capacity-bar" aria-label={`Бюджет покрывает ${coverage}% плана`}><i style={{ width: `${coverage}%` }} /></div>
      </div>

      <details className="summary-details">
        <summary>Что проверит ReelPay <ChevronDown size={16} /></summary>
        <div>
          <span><Check size={15} /> Ролик и право на публикацию</span>
          <span><Check size={15} /> Просмотры и резкие аномалии</span>
          <span><Check size={15} /> Условия выплаты</span>
        </div>
      </details>

      {showSubmit ? <SubmitButton /> : null}
      <small>После публикации заказ появится в витрине и станет доступен клипперам.</small>
    </>
  );
}

export function CampaignForm({
  initial,
  preferInitial = false
}: {
  initial?: { title?: string; description?: string; sourceUrl?: string; sourcePlatform?: string; niche?: string; platforms?: string[]; requiredTags?: string; bans?: string; watermarkBonus?: boolean; deliverableCount?: number; viewThreshold?: number; budget?: number; cpm?: number; minimumGuarantee?: number; deadlineDays?: number };
  preferInitial?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const draftTrackedRef = useRef(false);
  const [title, setTitle] = useState(initial?.title || "Нарезать стрим на сильные моменты");
  const [description, setDescription] = useState(initial?.description || "Найти 3-5 смешных или эмоциональных моментов, сделать вертикальные ролики 9:16, добавить крупные субтитры и цепляющий первый кадр.");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl || "");
  const [sourcePlatform, setSourcePlatform] = useState(initial?.sourcePlatform || "TWITCH");
  const [viewThreshold, setViewThreshold] = useState(initial?.viewThreshold || 10000);
  const [deliverableCount, setDeliverableCount] = useState(initial?.deliverableCount || 3);
  const [budget, setBudget] = useState(initial?.budget || 15000);
  const [cpm, setCpm] = useState(initial?.cpm || 25);
  const [minimumGuarantee, setMinimumGuarantee] = useState(initial?.minimumGuarantee ?? 100);
  const [deadlineDays, setDeadlineDays] = useState(initial?.deadlineDays || 7);
  const [niche, setNiche] = useState(initial?.niche || "Gaming");
  const [requiredTags, setRequiredTags] = useState(initial?.requiredTags || "#reelpay, #clips");
  const [bans, setBans] = useState(initial?.bans || "NSFW, политика, оскорбления, чужие логотипы крупным планом");
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms?.filter((platform) => platform !== "INSTAGRAM").length ? initial.platforms.filter((platform) => platform !== "INSTAGRAM") : ["TIKTOK", "YOUTUBE", "VK"]);
  const [watermarkBonus, setWatermarkBonus] = useState(initial?.watermarkBonus ?? true);
  const [isAdvertising, setIsAdvertising] = useState(true);
  const [draftSaved, setDraftSaved] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (preferInitial) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, string | string[]>;
      if (typeof draft.title === "string") setTitle(draft.title);
      if (typeof draft.description === "string") setDescription(draft.description);
      if (typeof draft.sourceUrl === "string") setSourceUrl(draft.sourceUrl);
      if (typeof draft.sourcePlatform === "string") setSourcePlatform(draft.sourcePlatform);
      if (typeof draft.viewThreshold === "string") setViewThreshold(Number(draft.viewThreshold) || 10000);
      if (typeof draft.deliverableCount === "string") setDeliverableCount(Number(draft.deliverableCount) || 3);
      if (typeof draft.budget === "string") setBudget(Number(draft.budget) || 15000);
      if (typeof draft.cpm === "string") setCpm(Number(draft.cpm) || 25);
      if (typeof draft.minimumGuarantee === "string") setMinimumGuarantee(Math.max(0, Number(draft.minimumGuarantee) || 0));
      if (typeof draft.deadlineDays === "string") setDeadlineDays(Number(draft.deadlineDays) || 7);
      if (typeof draft.niche === "string") setNiche(draft.niche);
      if (typeof draft.requiredTags === "string") setRequiredTags(draft.requiredTags);
      if (typeof draft.bans === "string") setBans(draft.bans);
      if (Array.isArray(draft.platforms) && draft.platforms.length) setPlatforms(draft.platforms);
      if (typeof draft.watermarkBonus === "string") setWatermarkBonus(draft.watermarkBonus === "on");

      requestAnimationFrame(() => {
        const form = formRef.current;
        if (!form) return;
        for (const [name, value] of Object.entries(draft)) {
          if (["platforms", "rightsConfirmed"].includes(name) || Array.isArray(value)) continue;
          const field = form.elements.namedItem(name);
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
            if (!field.matches("[type=checkbox], [type=radio]")) field.value = value;
          }
        }
      });
      setDraftSaved(true);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [preferInitial]);

  useEffect(() => {
    const maximum = grossPayout(viewThreshold, Math.max(0, cpm) * 100) / 100;
    setMinimumGuarantee((current) => Math.min(current, maximum));
  }, [cpm, viewThreshold]);

  function saveDraft() {
    if (!draftTrackedRef.current) {
      draftTrackedRef.current = true;
      void fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ type: "CAMPAIGN_DRAFT_STARTED", path: "/campaigns/new" })
      });
    }
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      const data = new FormData(form);
      const draft: Record<string, string | string[]> = {};
      for (const [name, value] of data.entries()) {
        if (name === "rightsConfirmed" || typeof value !== "string") continue;
        if (name === "platforms") {
          const values = draft.platforms;
          draft.platforms = Array.isArray(values) ? [...values, value] : [value];
        } else {
          draft[name] = value;
        }
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSaved(true);
    });
  }

  const estimate = useMemo(() => {
    const payout = grossPayout(viewThreshold, Math.max(0, cpm) * 100);
    const guarantee = Math.min(payout, Math.max(0, Math.round(minimumGuarantee * 100)));
    const grossViews = cpm > 0 ? Math.floor((budget / cpm) * 1000) : 0;
    const requiredBudget = Math.max(0, Math.round((payout * deliverableCount) / 100));
    const quality = cpm >= 35 ? "Клипперам будет интересно" : cpm >= 15 ? "Сбалансированная ставка" : "Можно усилить ставку";
    return { payout, guarantee, grossViews, requiredBudget, quality };
  }, [budget, cpm, deliverableCount, minimumGuarantee, viewThreshold]);

  function togglePlatform(value: string) {
    setPlatforms((current) => {
      if (current.includes(value)) return current.length === 1 ? current : current.filter((item) => item !== value);
      return [...current, value];
    });
  }

  function goNext() {
    const form = formRef.current;
    if (!form) return;
    const fields = [...form.querySelectorAll<HTMLElement>(`[data-wizard-field="${step}"] input, [data-wizard-field="${step}"] textarea, [data-wizard-field="${step}"] select`)];
    const invalid = fields.find((field) => "reportValidity" in field && !(field as HTMLInputElement).reportValidity());
    if (invalid) return;
    setStep((current) => Math.min(7, current + 1));
    window.scrollTo({ top: Math.max(0, form.offsetTop - 80), behavior: "smooth" });
  }

  return (
    <form ref={formRef} className="order-builder" action={createCampaignAction} onChange={saveDraft}>
      <div className="order-fields">
        <div className="order-draft-state" role="status">
          <span>{draftSaved ? "Черновик сохранён в этом браузере" : "Изменения будут сохранены автоматически"}</span>
          {draftSaved ? (
            <button type="button" onClick={() => { localStorage.removeItem(DRAFT_KEY); setDraftSaved(false); }}>
              Удалить черновик
            </button>
          ) : null}
        </div>
        <div className={styles.wizard} id="order-progress" aria-label="Шаги создания заказа">
          <div className={styles.wizardTop}>
            <b>Шаг {step} из 7</b>
            <span>{steps[step - 1]}</span>
          </div>
          <div className={styles.track} aria-hidden="true">
            {steps.map((label, index) => <i data-done={index + 1 <= step} key={label} />)}
          </div>
          <div className={styles.labels}>
            {steps.map((label, index) => (
              <button type="button" data-active={index + 1 === step} onClick={() => index + 1 < step && setStep(index + 1)} key={label}>
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </div>
        <section className="order-panel order-intro" hidden={step !== 1}>
          <span><Sparkles size={18} /> Новый заказ</span>
          <h1>Опиши задачу так, чтобы клиппер сразу понял результат</h1>
          <p>Чем яснее цель, исходник и правила, тем быстрее появятся хорошие ролики.</p>
        </section>

        <section className="order-panel" hidden={step !== 1 && step !== 2}>
          <div className="order-section-title">
            <b>1</b>
            <div>
              <h2>{step === 1 ? "Что продвигаем" : "Откуда брать материал"}</h2>
              <p>{step === 1 ? "Название, ниша и понятное описание результата." : "Укажите исходное видео и площадку, где оно размещено."}</p>
            </div>
          </div>

          <label className="order-field" data-wizard-field="1" hidden={step !== 1}>
            <span>Название</span>
            <input name="title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} required />
            <small>{title.length}/80</small>
          </label>

          <label className="order-field" data-wizard-field="2" hidden={step !== 2}>
            <span>Ссылка на исходное видео</span>
            <div className="order-input-icon">
              <Link2 size={18} />
              <input name="sourceUrl" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://twitch.tv/videos/..." required />
            </div>
          </label>

          <div className="order-grid-2" data-wizard-field="2" hidden={step !== 2}>
            <label className="order-field">
              <span>Где лежит исходник</span>
              <select name="sourcePlatform" value={sourcePlatform} onChange={(event) => setSourcePlatform(event.target.value)}>
                <option value="TWITCH">Twitch</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="VK">VK Видео</option>
                <option value="TIKTOK">TikTok</option>
                <option value="INSTAGRAM">Instagram*</option>
              </select>
            </label>
            {sourcePlatform === "INSTAGRAM" ? <MetaProductsNotice compact /> : null}

          </div>

          <label className="order-field" data-wizard-field="1" hidden={step !== 1}>
            <span>Ниша</span>
            <select name="niche" value={niche} onChange={(event) => setNiche(event.target.value)}>
              <option value="Gaming">Игры</option>
              <option value="Podcast">Подкаст</option>
              <option value="Business">Бизнес</option>
              <option value="Education">Обучение</option>
              <option value="Brand">Бренд</option>
              <option value="Humor">Юмор</option>
            </select>
          </label>

          <label className="order-field" data-wizard-field="1" hidden={step !== 1}>
            <span>Что нужно сделать</span>
            <textarea name="description" value={description} maxLength={420} onChange={(event) => setDescription(event.target.value)} required />
            <small>{description.length}/420</small>
          </label>
        </section>

        <section className="order-panel" data-wizard-field="3" hidden={step !== 3}>
          <div className="order-section-title">
            <b>2</b>
            <div>
              <h2>Результат</h2>
              <p>Точные параметры роликов, которые получит заказчик.</p>
            </div>
          </div>

          <div className="order-grid-2">
            <label className="order-field">
              <span>Количество роликов</span>
              <input name="deliverableCount" type="number" min={1} max={20} value={deliverableCount} onChange={(event) => setDeliverableCount(Number(event.target.value))} required />
            </label>
            <label className="order-field">
              <span>Длительность</span>
              <select name="clipDuration" defaultValue="30-60">
                <option value="15-30">15-30 секунд</option>
                <option value="30-60">30-60 секунд</option>
                <option value="60-90">60-90 секунд</option>
              </select>
            </label>
            <label className="order-field">
              <span>Формат</span>
              <select name="aspectRatio" defaultValue="9:16">
                <option value="9:16">Вертикальный 9:16</option>
                <option value="1:1">Квадратный 1:1</option>
                <option value="16:9">Горизонтальный 16:9</option>
              </select>
            </label>
            <label className="order-field">
              <span>Стиль</span>
              <select name="style" defaultValue="Динамичный">
                <option>Динамичный</option>
                <option>Разговорный</option>
                <option>Экспертный</option>
                <option>Юмор</option>
                <option>Минималистичный</option>
              </select>
            </label>
            <label className="order-field">
              <span>Язык</span>
              <select name="language" defaultValue="ru">
                <option value="ru">Русский</option>
                <option value="en">Английский</option>
              </select>
            </label>
            <label className="order-field">
              <span>Субтитры</span>
              <select name="subtitles" defaultValue="Обязательны">
                <option>Обязательны</option>
                <option>По желанию</option>
                <option>Не нужны</option>
              </select>
            </label>
          </div>
          <label className="order-field">
            <span>Что обязательно должно быть в ролике</span>
            <textarea name="mustInclude" maxLength={400} placeholder="Фразы, кадры, продукт, логотип или другие обязательные элементы" />
          </label>
          <label className="order-field">
            <span>Призыв к действию</span>
            <input name="cta" maxLength={180} placeholder="Например: подписаться на канал" />
          </label>
        </section>

        <section className="order-panel" hidden={step !== 4 && step !== 5}>
          <div className="order-section-title">
            <b>3</b>
            <div>
              <h2>{step === 4 ? "Где публиковать" : "Правила публикации"}</h2>
              <p>{step === 4 ? "Выберите площадки для готовых роликов." : "Примеры, обязательные теги и запреты."}</p>
            </div>
          </div>

          <div className="order-platforms" data-wizard-field="4" hidden={step !== 4}>
            {platformOptions.map(([value, label]) => (
              <label key={value}>
                <input type="checkbox" name="platforms" value={value} checked={platforms.includes(value)} onChange={() => togglePlatform(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <label className="order-field" data-wizard-field="5" hidden={step !== 5}>
            <span>Примеры роликов, до 3 ссылок</span>
            <textarea name="exampleUrls" placeholder={"https://youtube.com/shorts/...\nhttps://vk.com/clip-..."} />
          </label>
          <label className="order-field" data-wizard-field="5" hidden={step !== 5}>
            <span>Обязательные теги</span>
            <div className="order-input-icon">
              <Hash size={18} />
              <input name="requiredTags" value={requiredTags} onChange={(event) => setRequiredTags(event.target.value)} />
            </div>
          </label>
          <label className="order-field" data-wizard-field="5" hidden={step !== 5}>
            <span>Запреты</span>
            <textarea name="bans" value={bans} onChange={(event) => setBans(event.target.value)} />
          </label>
          <label className="order-check" data-wizard-field="5" hidden={step !== 5}>
            <input type="checkbox" name="watermarkBonus" checked={watermarkBonus} onChange={(event) => setWatermarkBonus(event.target.checked)} />
            <span><ShieldCheck size={18} /> Требовать watermark ReelPay для дополнительной проверки</span>
          </label>
        </section>

        <section className="order-panel" hidden={step !== 6 && step !== 7}>
          <div className="order-section-title">
            <b>4</b>
            <div>
              <h2>{step === 6 ? "Цель и бюджет" : "Срок и подтверждение"}</h2>
              <p>{step === 6 ? "Цель по просмотрам, ставка и максимальный резерв." : "Проверьте срок и подтвердите права на исходник."}</p>
            </div>
          </div>

          <div className="order-presets" data-wizard-field="6" hidden={step !== 6}>
            {viewOptions.map((views) => (
              <label key={views}>
                <input type="radio" name="viewThreshold" value={views} checked={viewThreshold === views} onChange={() => setViewThreshold(views)} />
                <span>{compactNumber(views)}</span>
              </label>
            ))}
          </div>

          <div className="order-grid-2" data-wizard-field="6" hidden={step !== 6}>
            <label className="order-field">
              <span>Бюджет, ₽</span>
              <input name="budget" type="number" min={1000} step={500} value={budget} onChange={(event) => setBudget(Number(event.target.value))} required />
            </label>
            <label className="order-field">
              <span>Ставка за 1000 просмотров, ₽</span>
              <input name="cpm" type="number" min={10} step={5} value={cpm} onChange={(event) => setCpm(Number(event.target.value))} required />
              <span className="order-chips">
                {([[15, "эконом"], [25, "рыночная"], [35, "быстрый разбор"]] as const).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={cpm === value ? "is-active" : ""}
                    onClick={() => setCpm(value)}
                  >
                    {value} ₽ · {label}
                  </button>
                ))}
              </span>
            </label>
            <label className="order-field">
              <span>Минимальная гарантия за проверенный ролик, ₽</span>
              <input
                name="minimumGuarantee"
                type="number"
                min={0}
                max={Math.max(0, Math.round(estimate.payout / 100))}
                step={50}
                value={minimumGuarantee}
                onChange={(event) => setMinimumGuarantee(Math.max(0, Number(event.target.value)))}
              />
              <span className="order-chips">
                {[0, 100, 300].map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={minimumGuarantee === value ? "is-active" : ""}
                    onClick={() => setMinimumGuarantee(Math.min(value, Math.round(estimate.payout / 100)))}
                  >
                    {value === 0 ? "Без гарантии" : `${value} ₽`}
                  </button>
                ))}
              </span>
              <small>Гарантия притягивает клипперов: даже при недоборе просмотров проверенный ролик получит не меньше этой суммы к сроку.</small>
            </label>
          </div>

          <div className="order-hint" hidden={step !== 6}>
            <AlertCircle size={17} />
            <span>Рыночная ставка за нарезки — 10–35 ₽ за 1000 просмотров. Выше 35 ₽ заказ разбирают быстрее, ниже 15 ₽ откликов может не быть.</span>
          </div>

          <label className="order-field" data-wizard-field="7" hidden={step !== 7}>
            <span>Срок</span>
            <select name="deadlineDays" value={deadlineDays} onChange={(event) => setDeadlineDays(Number(event.target.value))}>
              {deadlineOptions.map((days) => <option value={days} key={days}>{days} дней</option>)}
            </select>
          </label>

          <fieldset className={styles.reviewModes} data-wizard-field="7" hidden={step !== 7}>
            <legend>Кто проверяет черновик до публикации</legend>
            <label>
              <input type="radio" name="reviewMode" value="FAST" />
              <span><b>Быстрый</b><small>Проверенные клипперы проходят автоматически, остальные — через модератора.</small></span>
            </label>
            <label>
              <input type="radio" name="reviewMode" value="STANDARD" defaultChecked />
              <span><b>Стандартный</b><small>Черновик проверяет модератор ReelPay.</small></span>
            </label>
            <label>
              <input type="radio" name="reviewMode" value="STRICT" />
              <span><b>Строгий</b><small>Вы лично принимаете черновик перед публикацией.</small></span>
            </label>
          </fieldset>

          <label className="order-field" data-wizard-field="7" hidden={step !== 7}>
            <span>Допустимое число кругов правок</span>
            <select name="maxRevisionRounds" defaultValue="2">
              <option value="1">1 круг</option>
              <option value="2">2 круга</option>
              <option value="3">3 круга</option>
            </select>
            <small>Правки разрешены только в рамках опубликованного брифа.</small>
          </label>

          <label className="order-check" data-wizard-field="7" hidden={step !== 7}>
            <input type="checkbox" name="isAdvertising" checked={isAdvertising} onChange={(event) => setIsAdvertising(event.target.checked)} />
            <span><ShieldCheck size={18} /> Это рекламная кампания (нужна маркировка ЕРИР). Снимите галочку, если продвигаете собственный контент.</span>
          </label>
          {isAdvertising ? (
            <div className="order-grid-2" data-wizard-field="7" hidden={step !== 7}>
              <label className="order-field">
                <span>ИНН рекламодателя</span>
                <input name="advertiserInn" inputMode="numeric" maxLength={12} placeholder="10 или 12 цифр" />
                <small>Понадобится для регистрации креатива в ОРД и получения erid.</small>
              </label>
              <label className="order-field">
                <span>Наименование рекламодателя</span>
                <input name="advertiserName" maxLength={120} placeholder="ООО «Пример» или ИП Иванов" />
              </label>
            </div>
          ) : null}

          <label className="order-check" data-wizard-field="7" hidden={step !== 7}>
            <input type="checkbox" name="rightsConfirmed" required />
            <span><ShieldCheck size={18} /> Подтверждаю права на исходный материал и разрешаю его монтаж</span>
          </label>
          <label className="order-check" data-wizard-field="7" hidden={step !== 7}>
            <input type="checkbox" name="briefConfirmed" required />
            <span><Check size={18} /> Подтверждаю бриф версии 1. Правки за его пределами потребуют отдельной договорённости.</span>
          </label>
        </section>
        <div className={styles.nav}>
          <button type="button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>
            <ChevronLeft size={17} /> Назад
          </button>
          {step < 7
            ? <button type="button" onClick={goNext}>Продолжить <ArrowRight size={17} /></button>
            : <span className={styles.ready}>Проверьте итог и опубликуйте заказ</span>}
        </div>
        <details className="order-mobile-forecast">
          <summary><span>Прогноз заказа</span><b>{rub(estimate.payout)} за ролик</b><ChevronDown size={17} /></summary>
          <div className="order-mobile-forecast-body">
            <CampaignForecast
              payout={estimate.payout}
              guarantee={estimate.guarantee}
              viewThreshold={viewThreshold}
              cpm={cpm}
              budget={budget}
              grossViews={estimate.grossViews}
              deadlineDays={deadlineDays}
              deliverableCount={deliverableCount}
              requiredBudget={estimate.requiredBudget}
              quality={estimate.quality}
            />
          </div>
        </details>
      </div>

      <div className="order-mobile-submit" hidden={step !== 7}>
        <span><small>Резерв кампании</small><b>{rub(budget * 100)}</b></span>
        <SubmitButton />
      </div>

      <aside className="order-summary">
        <div className="summary-card">
          <CampaignForecast
            payout={estimate.payout}
            guarantee={estimate.guarantee}
            viewThreshold={viewThreshold}
            cpm={cpm}
            budget={budget}
            grossViews={estimate.grossViews}
            deadlineDays={deadlineDays}
            deliverableCount={deliverableCount}
            requiredBudget={estimate.requiredBudget}
            quality={estimate.quality}
            showSubmit={step === 7}
          />
        </div>
      </aside>

      <input type="hidden" name="trackingPrefix" value="REELPAY" />
      <input type="hidden" name="visibility" value="PUBLIC" />
    </form>
  );
}
