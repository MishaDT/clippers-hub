import { CalendarDays, Link2, UploadCloud, Zap } from "lucide-react";
import { AppShell, Card } from "@/components/ui";
import { createCampaignAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export default async function NewCampaignPage() {
  await requireUser();

  return (
    <AppShell>
      <section className="section order-screen">
        <div className="order-head">
          <span className="eyebrow">ReelPay</span>
          <h1>Создать заказ</h1>
          <div className="order-note">
            <span><Zap size={28} /></span>
            <p>Исполнители создадут ролики, а вы оплатите лучший результат по условиям кампании.</p>
          </div>
        </div>

        <form className="order-form" action={createCampaignAction}>
          <Card className="numbered-field">
            <div className="field-title"><span>1. Название заказа</span><small>0/80</small></div>
            <input name="title" defaultValue="Продвижение стрима с лучшими моментами" required />
          </Card>

          <Card className="numbered-field">
            <div className="field-title"><span>2. Что нужно сделать</span><small>0/300</small></div>
            <textarea name="description" defaultValue="Опишите задачу для исполнителей: стиль, акценты, ключевые моменты, призыв к действию. Например: динамичная нарезка смешных моментов с крупными субтитрами." />
          </Card>

          <Card className="numbered-field">
            <div className="field-title"><span>3. Ссылка на исходное видео</span><small><Link2 size={16} /></small></div>
            <input name="sourceUrl" defaultValue="https://twitch.tv/videos/source" required />
            <input type="hidden" name="sourcePlatform" value="TWITCH" />
          </Card>

          <Card className="numbered-field">
            <div className="field-title"><span>4. Цель по просмотрам</span><small>ориентир</small></div>
            <div className="segmented">
              {[5000, 10000, 25000, 50000, 100000].map((views) => (
                <label key={views}>
                  <input type="radio" name="viewThreshold" value={views} defaultChecked={views === 10000} />
                  <span>{views === 100000 ? "100 000+" : views.toLocaleString("ru-RU")}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="numbered-field">
            <div className="field-title"><span>5. Бюджет / оплата</span><small>RUB</small></div>
            <div className="grid grid-2">
              <input name="budget" type="number" defaultValue="150000" />
              <input name="cpm" type="number" defaultValue="50" aria-label="Оплата за 1000 просмотров" />
            </div>
            <p className="small">Первое поле - общий бюджет. Второе - сколько платим за 1000 просмотров.</p>
          </Card>

          <Card className="numbered-field">
            <div className="field-title"><span>6. Срок</span><small><CalendarDays size={16} /></small></div>
            <div className="segmented">
              {["3 дня", "5 дней", "7 дней", "10 дней"].map((label, index) => (
                <label key={label}>
                  <input type="radio" name="deadlinePreset" value={label} defaultChecked={index === 2} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <input type="hidden" name="deadline" value="2026-06-28" />
          </Card>

          <Card className="numbered-field">
            <div className="field-title"><span>7. Пример результата</span><small>необязательно</small></div>
            <div className="upload-line">
              <UploadCloud size={22} />
              <span>Загрузите пример ролика или вставьте ссылку</span>
              <button className="btn btn-ghost btn-small" type="button">Добавить ссылку</button>
            </div>
          </Card>

          <input type="hidden" name="niche" value="Funny moments" />
          <input type="hidden" name="requiredTags" value="#stream, #clips, #reelpay" />
          <input type="hidden" name="bans" value="NSFW, политика, оскорбления, чужие логотипы крупным планом" />
          <input type="hidden" name="platforms" value="TIKTOK" />
          <input type="hidden" name="platforms" value="YOUTUBE" />
          <input type="hidden" name="platforms" value="INSTAGRAM" />
          <input type="hidden" name="platforms" value="VK" />
          <input type="hidden" name="trackingPrefix" value="REELPAY" />
          <input type="hidden" name="visibility" value="FEATURED" />
          <input type="hidden" name="language" value="ru" />

          <button className="btn btn-primary btn-publish" type="submit">Опубликовать кампанию</button>
          <p className="small centered">Публикуя кампанию, вы соглашаетесь с правилами платформы.</p>
        </form>
      </section>
    </AppShell>
  );
}
