"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Eye, Megaphone, Sparkles, TrendingUp, Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { compactNumber, rub } from "@/lib/money";

export type MarketplaceCard = {
  id: string;
  title: string;
  description: string;
  niche: string | null;
  cpmRateCents: number;
  viewThreshold: number;
  remainingBudgetCents: number;
  featured: boolean;
  owner: { name: string; handle: string; avatar: string | null };
  submissions: number;
  deadlineMs: number;
  createdAtMs: number;
};

const DAY = 86_400_000;

function payoutOf(card: MarketplaceCard) {
  return Math.round((card.viewThreshold / 1000) * card.cpmRateCents * 0.89);
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
  alwaysTop
}: {
  cards: MarketplaceCard[];
  medianRate: number;
  pageSize: number;
  basePath: string;
  initialPage: number;
  page1Top: ReactNode;
  alwaysTop: ReactNode;
}) {
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
      {alwaysTop}

      {cards.length ? (
        <div className="mk-grid">
          {visible.map((card) => {
            const daysLeft = Math.max(1, Math.ceil((card.deadlineMs - Date.now()) / DAY));
            const payout = payoutOf(card);
            const cpm = Math.round(card.cpmRateCents / 100);
            const urgent = daysLeft <= 2;
            const fresh = Date.now() - card.createdAtMs <= 2 * DAY;
            const rateDelta = medianRate > 0 ? Math.round((card.cpmRateCents / medianRate - 1) * 100) : 0;
            const signal = card.featured
              ? { cls: "hot", Icon: Megaphone, text: "Продвижение", title: "Заказ поднят в выдаче через продвижение" }
              : card.remainingBudgetCents < payout
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
              <Link className="mk-card" href={`/campaigns/${card.id}`} key={card.id}>
                <div className="mk-card-top">
                  <div className="mk-client">
                    <UserAvatar avatar={card.owner.avatar} name={card.owner.name} handle={card.owner.handle} size={38} />
                    <div>
                      <strong>{card.owner.name}</strong>
                      <span>{card.niche || "Видео"}</span>
                    </div>
                  </div>
                  {signal && SignalIcon ? (
                    <span className={`mk-signal mk-signal--${signal.cls}`} title={signal.title}><SignalIcon size={12} /> {signal.text}</span>
                  ) : null}
                </div>
                <h2 className="mk-title">{card.title}</h2>
                <p className="mk-desc">{shortText(card.description)}</p>
                <div className="mk-payline">
                  <div className="mk-pay">
                    <b>{rub(payout)}</b>
                    <em>за результат · {cpm} ₽ / 1000</em>
                  </div>
                  <span className="mk-go">Открыть <ArrowRight size={15} /></span>
                </div>
                <div className="mk-meta">
                  <span><Eye size={14} /> {compactNumber(card.viewThreshold)}</span>
                  <span className={urgent ? "warn" : ""}><Clock3 size={14} /> {daysLeft} дн</span>
                  <span><Users size={14} /> {card.submissions}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mk-empty">
          <CheckCircle2 size={28} />
          <b>Подходящих заказов нет</b>
          <p>Попробуй убрать фильтр или написать запрос проще.</p>
          <Link className="btn btn-primary" href="/campaigns">Сбросить фильтры</Link>
        </div>
      )}

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
