"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, CircleAlert, Clock3, Eye, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { compactNumber, rub } from "@/lib/money";
import { MetaProductsNotice } from "@/components/meta-products-notice";

export type MarketplaceCard = {
  id: string;
  title: string;
  description: string;
  niche: string | null;
  platforms: string[];
  cpmRateCents: number;
  viewThreshold: number;
  payoutCents: number;
  minimumGuaranteeCents: number;
  remainingBudgetCents: number;
  reviewMode?: string;
  platformOrganized?: boolean;
  featured: boolean;
  demo: boolean;
  owner: { name: string; handle: string; avatar: string | null };
  submissions: number;
  deadlineMs: number;
  createdAtMs: number;
  matchScore?: number;
  matchReasons?: string[];
};

const DAY = 86_400_000;

const PLATFORM_NAMES: Record<string, string> = {
  YOUTUBE: "YouTube",
  VK: "VK Клипы",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram*",
  TWITCH: "Twitch"
};

export function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "YOUTUBE") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8.2 6.7 5.4 3.3-5.4 3.3V6.7Z" fill="#fff" /></svg>;
  if (platform === "INSTAGRAM") return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="10" cy="10" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="14.6" cy="5.6" r="1" fill="currentColor"/></svg>;
  if (platform === "TIKTOK") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11.2 4.1v8a3.1 3.1 0 1 1-2.7-3.1v1.7a1.4 1.4 0 1 0 1 1.4v-8h1.7Zm0 0c.4 1.5 1.3 2.3 2.8 2.7v1.7a5.2 5.2 0 0 1-2.8-1" fill="none" stroke="#25f4ee" strokeWidth="2.2"/><path d="M12.2 3.5v8a3.1 3.1 0 1 1-2.7-3.1v1.7a1.4 1.4 0 1 0 1 1.4v-8h1.7Zm0 0c.4 1.5 1.3 2.3 2.8 2.7v1.7a5.2 5.2 0 0 1-2.8-1" fill="none" stroke="#fe2c55" strokeWidth="2.2"/><path d="M11.7 3.8v8a3.1 3.1 0 1 1-2.7-3.1v1.7a1.4 1.4 0 1 0 1 1.4v-8h1.7Zm0 0c.4 1.5 1.3 2.3 2.8 2.7v1.7a5.2 5.2 0 0 1-2.8-1" fill="none" stroke="#fff" strokeWidth="1.25"/></svg>;
  if (platform === "TWITCH") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h13v9l-4 4H9l-2.2 2v-2H4V3Zm2 2v9h2.5v1.3L10 14h3l2-2V5H6Zm3 2h2v4H9V7Zm3.5 0h2v4h-2V7Z" fill="currentColor"/></svg>;
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.4 5.2h3.1c.2 0 .4.1.5.4.7 2 1.8 3.7 2.4 4.3.3.3.5.2.5-.2V5.9c0-.5.2-.7.7-.7h2.4c.4 0 .6.2.6.7v3.2c0 .4.2.5.4.2.7-.8 1.7-2.4 2.2-3.6.1-.3.4-.5.7-.5h2.9c.6 0 .8.3.5.8-.6 1.2-1.9 3.1-2.8 4.1-.3.4-.3.7 0 1 1 .9 2.6 2.6 3.2 3.8.2.4 0 .7-.5.7h-3.2c-.4 0-.6-.2-.8-.5-.5-.9-1.4-2.1-2-2.6-.3-.3-.6-.2-.6.3v2.1c0 .5-.2.7-.7.7h-1.5c-3.7 0-6.5-3.3-7.9-9.6-.1-.5.1-.8.6-.8Z" fill="currentColor"/></svg>;
}

function shortText(text: string, limit = 120) {
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

export function MarketplaceBrowser({
  cards,
  medianRate,
  pageSize,
  basePath,
  initialPage,
  page1Top,
  alwaysTop,
  compactTop
}: {
  cards: MarketplaceCard[];
  medianRate: number;
  pageSize: number;
  basePath: string;
  initialPage: number;
  page1Top: ReactNode;
  alwaysTop: ReactNode;
  compactTop: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));

  const readPage = useCallback(() => {
    if (typeof window === "undefined") return 1;
    const value = Number(new URLSearchParams(window.location.search).get("page") || 1);
    return Math.min(totalPages, Math.max(1, value || 1));
  }, [totalPages]);

  const [page, setPage] = useState(() => Math.min(totalPages, Math.max(1, initialPage)));
  useEffect(() => setPage(readPage()), [readPage]);

  useEffect(() => {
    const sync = () => setPage(readPage());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [readPage]);

  const go = useCallback((next: number) => {
    const target = Math.min(totalPages, Math.max(1, next));
    setPage(target);
    const params = new URLSearchParams(window.location.search);
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const query = params.toString();
    window.history.pushState(null, "", query ? `${basePath}?${query}` : basePath);
    document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [basePath, totalPages]);

  const visible = useMemo(() => cards.slice((page - 1) * pageSize, page * pageSize), [cards, page, pageSize]);

  return (
    <>
      {page === 1 ? page1Top : null}
      {page === 1 ? alwaysTop : compactTop}

      {cards.length ? (
        <div className="mk-grid">
          {visible.map((card) => {
            const daysLeft = Math.max(1, Math.ceil((card.deadlineMs - Date.now()) / DAY));
            const payout = card.payoutCents;
            const cpm = Math.round(card.cpmRateCents / 100);
            const urgent = daysLeft <= 2;
            const fresh = Date.now() - card.createdAtMs <= 2 * DAY;
            const rateDelta = medianRate > 0 ? Math.round((card.cpmRateCents / medianRate - 1) * 100) : 0;
            const signal = card.remainingBudgetCents < payout
                ? { cls: "urgent", Icon: CircleAlert, text: "Мало бюджета", title: "Остатка бюджета может не хватить на полную выплату" }
                : urgent
                  ? { cls: "urgent", Icon: Clock3, text: `${daysLeft} дн.`, title: "Короткий срок до дедлайна" }
                  : rateDelta >= 25
                    ? { cls: "pay", Icon: TrendingUp, text: `Ставка +${rateDelta}%`, title: "Сравнение с медианной ставкой текущей выдачи" }
                    : fresh
                      ? { cls: "new", Icon: Sparkles, text: "Новый", title: "Опубликован меньше 48 часов назад" }
                      : null;
            const SignalIcon = signal?.Icon;
            return (
              <Link
                className="mk-card"
                href={`/campaigns/${card.id}?returnTo=${encodeURIComponent(returnTo)}`}
                key={card.id}
                onClick={() => {
                  void fetch("/api/analytics", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    keepalive: true,
                    body: JSON.stringify({
                      type: "CAMPAIGN_CARD_OPEN",
                      path: returnTo,
                      metadata: { campaignId: card.id }
                    })
                  });
                }}
              >
                <div className="mk-card-top">
                  <div className="mk-platforms" aria-label={`Площадки: ${card.platforms.map((platform) => PLATFORM_NAMES[platform] || platform).join(", ")}`}>
                    {card.platforms.slice(0, 3).map((platform) => (
                      <span
                        className={`mk-platform mk-platform--${platform.toLowerCase()}`}
                        aria-label={PLATFORM_NAMES[platform] || platform}
                        role="img"
                        title={PLATFORM_NAMES[platform] || platform}
                        key={platform}
                      >
                        <PlatformIcon platform={platform} />
                      </span>
                    ))}
                  </div>
                  <div className="mk-card-signals">
                    {typeof card.matchScore === "number" && card.matchScore >= 65 ? (
                      <span className="mk-match" title={card.matchReasons?.join(" · ")}>
                        <Sparkles size={12} /> Подходит вам
                      </span>
                    ) : null}
                    {card.platformOrganized ? <span className="mk-seed" title="Кампанию запускает ReelPay"><BadgeCheck size={12} /> Организовано ReelPay</span> : null}
                    {card.reviewMode === "FAST" ? <span className="mk-fast" title="Публикация сразу после проверки платформы"><Zap size={12} /> Быстрая публикация</span> : null}
                    {signal && SignalIcon ? (
                      <span className={`mk-signal mk-signal--${signal.cls}`} title={signal.title}><SignalIcon size={12} /> {signal.text}</span>
                    ) : null}
                  </div>
                </div>
                <h2 className="mk-title">{card.title}</h2>
                <p className="mk-desc">{shortText(card.description)}</p>
                <div className="mk-meta" aria-label="Условия заказа">
                  <span><Eye size={14} /> {compactNumber(card.viewThreshold)} просмотров</span>
                  <span className={urgent ? "warn" : ""}><Clock3 size={14} /> {daysLeft} дн.</span>
                  <span><Users size={14} /> {card.submissions} в работе</span>
                </div>
                <div className="mk-card-footer">
                  <div className="mk-client">
                    <UserAvatar avatar={card.owner.avatar} name={card.owner.name} handle={card.owner.handle} size={32} />
                    <div>
                      <strong>{card.owner.name}</strong>
                      <span>{card.niche || "Видео"}</span>
                    </div>
                  </div>
                  <div className="mk-pay">
                    <b>{rub(payout)}</b>
                    <em>{card.minimumGuaranteeCents > 0 ? `гарантия ${rub(card.minimumGuaranteeCents)} · ` : ""}{cpm} ₽ / 1000</em>
                  </div>
                  <span className="mk-go" aria-hidden="true"><ArrowRight size={17} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mk-empty">
          <CheckCircle2 size={28} />
          <b>{searchParams.size ? "Подходящих заказов нет" : "Новые заказы готовятся"}</b>
          <p>{searchParams.size ? "Убери фильтр или напиши запрос проще." : "Здесь показываются только реальные кампании с подтверждённым бюджетом — без выдуманных заказчиков и просмотров."}</p>
          {searchParams.size ? <Link className="btn btn-primary" href="/campaigns">Сбросить фильтры</Link> : null}
        </div>
      )}

      {visible.some((card) => card.platforms.includes("INSTAGRAM")) ? (
        <div className="mk-legal-notice"><MetaProductsNotice compact /></div>
      ) : null}

      {totalPages > 1 ? (
        <nav className="mk-pages" aria-label="Страницы заказов">
          <button disabled={page <= 1} onClick={() => go(page - 1)}>Назад</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => go(page + 1)}>Дальше</button>
        </nav>
      ) : null}
    </>
  );
}
