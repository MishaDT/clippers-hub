import { ArrowRight, BadgeCheck, BarChart3, Link2, MousePointerClick, ShoppingBag, Target } from "lucide-react";
import {
  createCampaignTrackingLinkAction,
  disableCampaignTrackingLinkAction,
  updateCampaignOutcomeAction
} from "@/app/actions";
import { compactNumber, rub } from "@/lib/money";
import { calculateCampaignPerformance } from "@/lib/campaign-performance";
import styles from "./campaign-performance.module.css";

type TrackingLink = {
  id: string;
  code: string;
  targetUrl: string;
  active: boolean;
  clicks: number;
};

type Props = {
  campaignId: string;
  returnTo: string;
  views: number;
  clicks: number;
  spentCents: number;
  leads: number;
  sales: number;
  revenueCents: number;
  outcomeSaved: boolean;
  trackingLinks: TrackingLink[];
};

function ratio(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)}%`;
}

export function CampaignPerformance({
  campaignId,
  returnTo,
  views,
  clicks,
  spentCents,
  leads,
  sales,
  revenueCents,
  outcomeSaved,
  trackingLinks
}: Props) {
  const performance = calculateCampaignPerformance({ views, clicks, spentCents, leads, sales, revenueCents });

  return (
    <section className={styles.section} id="campaign-performance" aria-labelledby="campaign-performance-title">
      <header className={styles.header}>
        <div>
          <span><BarChart3 size={15} /> Результат для бизнеса</span>
          <h2 id="campaign-performance-title">От просмотров до продаж</h2>
          <p>ReelPay считает охват и переходы. Добавьте подтверждённые данные из CRM или магазина — экономика кампании соберётся в одном отчёте.</p>
        </div>
        {outcomeSaved ? <strong className={styles.saved}><BadgeCheck size={15} /> Результат обновлён</strong> : null}
      </header>

      <div className={styles.funnel} aria-label="Воронка кампании">
        <div><span>Просмотры</span><b>{compactNumber(views)}</b><small>из публикаций</small></div>
        <ArrowRight aria-hidden="true" />
        <div><span>Переходы</span><b>{compactNumber(clicks)}</b><small>{performance.ctrPercent !== null ? `CTR ${ratio(performance.ctrPercent)}` : "добавьте ссылку"}</small></div>
        <ArrowRight aria-hidden="true" />
        <div><span>Лиды</span><b>{compactNumber(leads)}</b><small>{performance.costPerLeadCents !== null ? `CPL ${rub(performance.costPerLeadCents)}` : "из вашей CRM"}</small></div>
        <ArrowRight aria-hidden="true" />
        <div><span>Продажи</span><b>{compactNumber(sales)}</b><small>{performance.costPerSaleCents !== null ? `${rub(performance.costPerSaleCents)} за продажу` : "подтверждённые"}</small></div>
      </div>

      <div className={styles.metrics}>
        <div><MousePointerClick size={17} /><span>Цена перехода</span><b>{performance.costPerClickCents !== null ? rub(performance.costPerClickCents) : "—"}</b></div>
        <div><Target size={17} /><span>Потрачено</span><b>{rub(spentCents)}</b></div>
        <div><ShoppingBag size={17} /><span>Выручка</span><b>{rub(revenueCents)}</b></div>
        <div data-positive={performance.roasPercent !== null && performance.roasPercent >= 100}><BarChart3 size={17} /><span>ROAS</span><b>{performance.roasPercent !== null ? ratio(performance.roasPercent) : "—"}</b></div>
      </div>

      <div className={styles.controls}>
        <form className={styles.outcomeForm} action={updateCampaignOutcomeAction}>
          <div className={styles.controlTitle}>
            <div><b>Добавить результат</b><span>Только подтверждённые данные из CRM, промокодов или магазина.</span></div>
          </div>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label><span>Лиды</span><input name="leads" type="number" min="0" max="1000000000" defaultValue={leads} /></label>
          <label><span>Продажи</span><input name="sales" type="number" min="0" max="1000000000" defaultValue={sales} /></label>
          <label><span>Выручка, ₽</span><input name="revenue" type="number" min="0" step="1" defaultValue={Math.round(revenueCents / 100)} /></label>
          <button type="submit">Пересчитать отчёт</button>
        </form>

        <div className={styles.tracking}>
          <div className={styles.controlTitle}>
            <Link2 size={18} />
            <div><b>Ссылка с подсчётом переходов</b><span>IP не сохраняется — только обезличенный счётчик.</span></div>
          </div>
          <form className={styles.linkForm} action={createCampaignTrackingLinkAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input name="targetUrl" type="url" inputMode="url" placeholder="https://ваш-сайт.ru/предложение" required />
            <button type="submit">Создать</button>
          </form>
          <div className={styles.links}>
            {trackingLinks.map((link) => (
              <div key={link.id} data-active={link.active}>
                <a href={`/track/${link.code}`} target="_blank" rel="noreferrer">/track/{link.code}</a>
                <span>{link.clicks} переходов</span>
                {link.active ? (
                  <form action={disableCampaignTrackingLinkAction}>
                    <input type="hidden" name="linkId" value={link.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit">Отключить</button>
                  </form>
                ) : <em>Отключена</em>}
              </div>
            ))}
            {!trackingLinks.length ? <p>Создайте ссылку и вставьте её в описание ролика или закреплённый комментарий.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
