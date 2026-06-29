"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Landmark } from "lucide-react";

export type AffiliateOffer = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string;
  href?: string;
  qrDataUrl?: string;
};

export function AffiliateCarousel({ offers }: { offers: AffiliateOffer[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const move = (direction: number) => setActive((current) => (current + direction + offers.length) % offers.length);

  useEffect(() => {
    if (paused || offers.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % offers.length), 12000);
    return () => window.clearInterval(timer);
  }, [offers.length, paused]);

  if (!offers.length) return null;

  return (
    <section
      className="affiliate-carousel"
      aria-label="Предложения партнёров"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current == null) return;
        const delta = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(delta) > 42) move(delta < 0 ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <div className="affiliate-track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {offers.map((offer, index) => (
          <article aria-hidden={active !== index} key={offer.id}>
            <span className="affiliate-eyebrow"><Landmark size={14} /> {offer.eyebrow}</span>
            <h3>{offer.title}</h3>
            <p>{offer.description}</p>
            {offer.qrDataUrl ? <img src={offer.qrDataUrl} alt={`QR-код: ${offer.title}`} width={104} height={104} /> : null}
            {offer.href && offer.ctaLabel ? (
              <a href={offer.href} target="_blank" rel="noopener noreferrer sponsored nofollow" tabIndex={active === index ? 0 : -1}>
                {offer.ctaLabel} <ArrowUpRight size={15} />
              </a>
            ) : <small>Предложения партнёров появятся здесь</small>}
          </article>
        ))}
      </div>
      {offers.length > 1 ? (
        <footer>
          <button type="button" onClick={() => move(-1)} aria-label="Предыдущее предложение"><ChevronLeft size={16} /></button>
          <span>{active + 1} / {offers.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Следующее предложение"><ChevronRight size={16} /></button>
        </footer>
      ) : null}
    </section>
  );
}
