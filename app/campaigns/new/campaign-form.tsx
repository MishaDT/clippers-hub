"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Hash,
  Link2,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards
} from "lucide-react";
import { createCampaignAction } from "@/app/actions";
import { compactNumber, rub } from "@/lib/money";

const platformOptions = [
  ["TIKTOK", "TikTok"],
  ["YOUTUBE", "Shorts"],
  ["INSTAGRAM", "Reels"],
  ["VK", "VK Clips"]
] as const;

const viewOptions = [5000, 10000, 25000, 50000] as const;
const deadlineOptions = [3, 5, 7, 10] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="order-submit" type="submit" disabled={pending}>
      {pending ? "Публикуем..." : "Опубликовать заказ"} <ArrowRight size={18} />
    </button>
  );
}

export function CampaignForm() {
  const [title, setTitle] = useState("Нарезать стрим на сильные моменты");
  const [description, setDescription] = useState("Найти 3-5 смешных или эмоциональных моментов, сделать вертикальные ролики 9:16, добавить крупные субтитры и цепляющий первый кадр.");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePlatform, setSourcePlatform] = useState("TWITCH");
  const [viewThreshold, setViewThreshold] = useState(10000);
  const [budget, setBudget] = useState(15000);
  const [cpm, setCpm] = useState(50);
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [niche, setNiche] = useState("Gaming");
  const [requiredTags, setRequiredTags] = useState("#reelpay, #clips");
  const [bans, setBans] = useState("NSFW, политика, оскорбления, чужие логотипы крупным планом");
  const [platforms, setPlatforms] = useState<string[]>(["TIKTOK", "YOUTUBE", "INSTAGRAM"]);
  const [watermarkBonus, setWatermarkBonus] = useState(true);
  const [featured, setFeatured] = useState(false);

  const estimate = useMemo(() => {
    const payout = Math.max(0, Math.round((viewThreshold / 1000) * cpm * 0.89 * 100));
    const grossViews = cpm > 0 ? Math.floor((budget / cpm) * 1000) : 0;
    const clipperCapacity = payout > 0 ? Math.max(1, Math.floor((budget * 100) / payout)) : 0;
    const quality = cpm >= 70 ? "Высокий интерес" : cpm >= 45 ? "Нормальная ставка" : "Ставка низкая";
    return { payout, grossViews, clipperCapacity, quality };
  }, [budget, cpm, viewThreshold]);

  function togglePlatform(value: string) {
    setPlatforms((current) => {
      if (current.includes(value)) return current.length === 1 ? current : current.filter((item) => item !== value);
      return [...current, value];
    });
  }

  return (
    <form className="order-builder" action={createCampaignAction}>
      <div className="order-fields">
        <section className="order-panel order-intro">
          <span><Sparkles size={18} /> Новый заказ</span>
          <h1>Опиши задачу так, чтобы клиппер сразу понял результат</h1>
          <p>Чем яснее цель, исходник и правила, тем быстрее появятся хорошие ролики.</p>
        </section>

        <section className="order-panel">
          <div className="order-section-title">
            <b>1</b>
            <div>
              <h2>Основа заказа</h2>
              <p>Название, исходник и короткое описание результата.</p>
            </div>
          </div>

          <label className="order-field">
            <span>Название</span>
            <input name="title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} required />
            <small>{title.length}/80</small>
          </label>

          <label className="order-field">
            <span>Ссылка на исходное видео</span>
            <div className="order-input-icon">
              <Link2 size={18} />
              <input name="sourceUrl" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://twitch.tv/videos/..." required />
            </div>
          </label>

          <div className="order-grid-2">
            <label className="order-field">
              <span>Где лежит исходник</span>
              <select name="sourcePlatform" value={sourcePlatform} onChange={(event) => setSourcePlatform(event.target.value)}>
                <option value="TWITCH">Twitch</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="VK">VK Видео</option>
                <option value="TIKTOK">TikTok</option>
                <option value="INSTAGRAM">Instagram</option>
              </select>
            </label>

            <label className="order-field">
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
          </div>

          <label className="order-field">
            <span>Что нужно сделать</span>
            <textarea name="description" value={description} maxLength={420} onChange={(event) => setDescription(event.target.value)} required />
            <small>{description.length}/420</small>
          </label>
        </section>

        <section className="order-panel">
          <div className="order-section-title">
            <b>2</b>
            <div>
              <h2>Оплата и цель</h2>
              <p>Сколько просмотров нужно и сколько платим за 1000 просмотров.</p>
            </div>
          </div>

          <div className="order-presets">
            {viewOptions.map((views) => (
              <label key={views}>
                <input type="radio" name="viewThreshold" value={views} checked={viewThreshold === views} onChange={() => setViewThreshold(views)} />
                <span>{compactNumber(views)}</span>
              </label>
            ))}
          </div>

          <div className="order-grid-2">
            <label className="order-field">
              <span>Бюджет, ₽</span>
              <input name="budget" type="number" min={1000} step={500} value={budget} onChange={(event) => setBudget(Number(event.target.value))} required />
            </label>
            <label className="order-field">
              <span>Ставка за 1000 просмотров, ₽</span>
              <input name="cpm" type="number" min={10} step={5} value={cpm} onChange={(event) => setCpm(Number(event.target.value))} required />
            </label>
          </div>

          <div className="order-hint">
            <AlertCircle size={17} />
            <span>Для старта лучше держать ставку от 45 ₽ за 1000 просмотров. Ниже клипперы будут выбирать заказ реже.</span>
          </div>
        </section>

        <section className="order-panel">
          <div className="order-section-title">
            <b>3</b>
            <div>
              <h2>Публикация и правила</h2>
              <p>Куда можно выкладывать ролики и что обязательно указать.</p>
            </div>
          </div>

          <div className="order-platforms">
            {platformOptions.map(([value, label]) => (
              <label key={value}>
                <input type="checkbox" name="platforms" value={value} checked={platforms.includes(value)} onChange={() => togglePlatform(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="order-grid-2">
            <label className="order-field">
              <span>Срок</span>
              <select name="deadlineDays" value={deadlineDays} onChange={(event) => setDeadlineDays(Number(event.target.value))}>
                {deadlineOptions.map((days) => <option value={days} key={days}>{days} дней</option>)}
              </select>
            </label>

            <label className="order-field">
              <span>Видимость</span>
              <select name="visibility" value={featured ? "FEATURED" : "PUBLIC"} onChange={(event) => setFeatured(event.target.value === "FEATURED")}>
                <option value="PUBLIC">Обычная</option>
                <option value="FEATURED">В топ витрины</option>
              </select>
            </label>
          </div>

          <label className="order-field">
            <span>Обязательные теги</span>
            <div className="order-input-icon">
              <Hash size={18} />
              <input name="requiredTags" value={requiredTags} onChange={(event) => setRequiredTags(event.target.value)} />
            </div>
          </label>

          <label className="order-field">
            <span>Запреты</span>
            <textarea name="bans" value={bans} onChange={(event) => setBans(event.target.value)} />
          </label>

          <label className="order-check">
            <input type="checkbox" name="watermarkBonus" checked={watermarkBonus} onChange={(event) => setWatermarkBonus(event.target.checked)} />
            <span><ShieldCheck size={18} /> +5% к ставке за watermark ReelPay</span>
          </label>
        </section>
      </div>

      <aside className="order-summary">
        <div className="summary-card">
          <span className="summary-kicker">Прогноз заказа</span>
          <h2>{rub(estimate.payout)}</h2>
          <p>примерная выплата клипперу за ролик, который доберёт цель</p>

          <div className="summary-metrics">
            <span><Target size={17} /><b>{compactNumber(viewThreshold)}</b><em>цель</em></span>
            <span><WalletCards size={17} /><b>{rub(budget * 100)}</b><em>бюджет</em></span>
            <span><MonitorPlay size={17} /><b>{compactNumber(estimate.grossViews)}</b><em>потенциал</em></span>
            <span><CalendarDays size={17} /><b>{deadlineDays} дн.</b><em>срок</em></span>
          </div>

          <div className="summary-quality">
            <CircleDollarSign size={18} />
            <div>
              <b>{estimate.quality}</b>
              <span>Хватит примерно на {estimate.clipperCapacity} успешных роликов.</span>
            </div>
          </div>

          <div className="summary-checklist">
            <span><Check size={15} /> Деньги резервируются</span>
            <span><Check size={15} /> Платишь только за результат</span>
            <span><Check size={15} /> Просмотры проверяются</span>
          </div>

          <SubmitButton />
          <small>После публикации заказ появится в витрине и будет доступен клипперам.</small>
        </div>
      </aside>

      <input type="hidden" name="trackingPrefix" value="REELPAY" />
      <input type="hidden" name="language" value="ru" />
    </form>
  );
}
