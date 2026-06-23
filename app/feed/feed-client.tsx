"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { compactNumber, rub } from "@/lib/money";

type FeedCampaign = {
  id: string;
  title: string;
  description: string;
  niche: string | null;
  viewThreshold: number;
  cpmRateCents: number;
  deadline: string;
  ownerName: string;
  ownerAvatar: string;
  submissions: number;
  views: number;
  cover: string;
  video: string;
};

const tabs = ["Для тебя", "Тренды"] as const;
type Tab = (typeof tabs)[number];

export function FeedClient({ campaigns }: { campaigns: FeedCampaign[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("Для тебя");
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const feedRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const visible = useMemo(() => {
    const list = [...campaigns];
    if (activeTab === "Тренды") return list.sort((a, b) => b.views - a.views).slice(0, 12);
    return list;
  }, [activeTab, campaigns]);

  function switchTab(dir: 1 | -1) {
    const next = tabs[(tabs.indexOf(activeTab) + dir + tabs.length) % tabs.length];
    if (next !== activeTab) setActiveTab(next);
  }

  // Only the reel snapped into view plays; track its index to preload the next one.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActiveIndex(Number(video.dataset.index) || 0);
            void video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    videoRefs.current.forEach((video) => observer.observe(video));
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    setActiveIndex(0);
    feedRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") switchTab(1);
      else if (e.key === "ArrowLeft") switchTab(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) switchTab(dx < 0 ? 1 : -1);
  }

  return (
    <>
      <div className="feed-tabs" role="tablist" aria-label="Лента">
        {tabs.map((tab) => (
          <button className={activeTab === tab ? "active" : ""} type="button" onClick={() => setActiveTab(tab)} key={tab}>
            {tab === "Тренды" ? <Flame size={15} /> : null}
            {tab}
          </button>
        ))}
      </div>

      <div className="reel-feed" ref={feedRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {visible.map((campaign, index) => {
          const expected = Math.round((campaign.viewThreshold / 1000) * campaign.cpmRateCents * 0.89);
          const days = Math.max(1, Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86400000));
          const near = Math.abs(index - activeIndex) <= 1; // preload current + neighbours only

          return (
            <article className="reel" key={campaign.id}>
              <video
                className="reel-video"
                data-index={index}
                ref={(el) => {
                  if (el) videoRefs.current.set(campaign.id, el);
                  else videoRefs.current.delete(campaign.id);
                }}
                src={campaign.video}
                poster={near ? campaign.cover : undefined}
                muted
                loop
                playsInline
                preload={near ? "auto" : "none"}
              />
              <div className="reel-shade" />

              <div className="reel-info">
                <div className="reel-creator-row">
                  <img src={campaign.ownerAvatar} alt="" />
                  <div className="reel-creator-meta">
                    <strong>{campaign.ownerName}</strong>
                    <span>{compactNumber(campaign.views || 128000)} подписчиков</span>
                  </div>
                </div>
                <h2><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></h2>
                <div className="reel-pay-row">
                  <b>до {rub(expected)}</b>
                  <span>за выполнение · {days} дн.</span>
                </div>
                <Link className="btn btn-primary reel-cta" href={`/campaigns/${campaign.id}`}>Смотреть заказ →</Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
