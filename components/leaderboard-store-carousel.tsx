"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, QrCode, ShoppingBag, X } from "lucide-react";

export type LeaderboardStoreOffer = {
  id: string;
  title: string;
  provider: string;
  imageUrl: string | null;
  category: string;
  feature: string;
};

export function LeaderboardStoreCarousel({ offers }: { offers: LeaderboardStoreOffer[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [cycle, setCycle] = useState(0);
  const touchStart = useRef<number | null>(null);

  const select = (next: number) => {
    setActive((next + offers.length) % offers.length);
    setQrOpen(false);
    setCycle((value) => value + 1);
  };

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused || qrOpen || !visible || offers.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % offers.length), 10000);
    return () => window.clearTimeout(timer);
  }, [active, cycle, offers.length, paused, qrOpen, visible]);

  if (!offers.length) return null;
  const offer = offers[active];

  return (
    <section
      className="leaderboard-store-carousel"
      aria-label="Рекомендуемые предложения магазина"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current == null) return;
        const delta = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(delta) > 42) select(active + (delta < 0 ? 1 : -1));
        touchStart.current = null;
      }}
    >
      <header>
        <span><ShoppingBag size={14} /> Магазин ReelPay</span>
        <em>Реклама</em>
      </header>

      <div className={`leaderboard-store-card ${qrOpen ? "show-qr" : ""}`}>
        <div className="leaderboard-store-front">
          <div className="leaderboard-store-brand">
            <span>
              {offer.imageUrl ? <Image src={offer.imageUrl} alt="" width={56} height={56} loading="lazy" unoptimized /> : <ShoppingBag size={24} />}
            </span>
            <div><small>{offer.category}</small><b>{offer.provider}</b></div>
          </div>
          <h3>{offer.title}</h3>
          <p>{offer.feature}</p>
          <div className="leaderboard-store-actions">
            <a href={`/go/offer/${offer.id}?from=leaderboard`} target="_blank" rel="noopener noreferrer sponsored nofollow">
              Оформить <ArrowUpRight size={14} />
            </a>
            <button type="button" onClick={() => setQrOpen(true)} aria-label={`Показать QR-код: ${offer.title}`}><QrCode size={17} /></button>
          </div>
        </div>
        <div className="leaderboard-store-qr" aria-hidden={!qrOpen}>
          <button type="button" onClick={() => setQrOpen(false)} aria-label="Закрыть QR-код"><X size={15} /></button>
          <Image src={`/api/store/partner-qr/${offer.id}`} alt={`QR-код: ${offer.title}`} loading="lazy" width={126} height={126} unoptimized />
          <b>Откройте камерой телефона</b>
          <small>{offer.provider}</small>
        </div>
      </div>

      <footer>
        <button type="button" onClick={() => select(active - 1)} aria-label="Предыдущее предложение"><ChevronLeft size={15} /></button>
        <div>
          {offers.map((item, index) => (
            <button
              className={index === active ? "active" : ""}
              type="button"
              aria-current={index === active}
              aria-label={`Предложение ${index + 1}: ${item.title}`}
              onClick={() => select(index)}
              key={item.id}
            />
          ))}
        </div>
        <button type="button" onClick={() => select(active + 1)} aria-label="Следующее предложение"><ChevronRight size={15} /></button>
      </footer>
      <Link className="leaderboard-store-more" href="/store?tab=partners">
        Смотреть весь магазин <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
