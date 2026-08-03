"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { compactNumber, expectedPayout, minimumGuaranteedPayout, rub } from "@/lib/money";
type RoleMode = "worker" | "client";

type FeedCampaign = {
  id: string;
  title: string;
  description: string;
  niche: string | null;
  viewThreshold: number;
  cpmRateCents: number;
  minimumGuaranteeCents: number;
  deadline: string;
  ownerName: string;
  ownerAvatar: string;
  submissions: number;
  views: number;
  cover: string;
};

const tabs = ["Для тебя", "Тренды"] as const;
type Tab = (typeof tabs)[number];

export function FeedClient({ campaigns, mode }: { campaigns: FeedCampaign[]; mode: RoleMode }) {
  const [activeTab, setActiveTab] = useState<Tab>("Для тебя");
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

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const direction = e.key === "ArrowRight" ? 1 : -1;
      setActiveTab((current) => tabs[(tabs.indexOf(current) + direction + tabs.length) % tabs.length]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        {!visible.length ? (
          <div className="empty-box"><h2>Открытых заказов пока нет</h2><p>Новые реальные кампании появятся здесь после публикации заказчиком.</p></div>
        ) : null}
        {visible.map((campaign) => {
          const expected = expectedPayout(campaign.viewThreshold, campaign.cpmRateCents);
          const guarantee = minimumGuaranteedPayout(campaign.minimumGuaranteeCents);
          const days = Math.max(1, Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86400000));
          return (
            <article className="reel" key={campaign.id}>
              <Image
                className="reel-video"
                src={campaign.cover}
                alt=""
                fill
                sizes="(max-width: 760px) 100vw, 720px"
              />
              <div className="reel-shade" />

              <span className="reel-demo-badge">Открытый заказ</span>

              <div className="reel-info">
                <div className="reel-creator-row">
                  <Image src={campaign.ownerAvatar} alt="" width={44} height={44} loading="lazy" unoptimized />
                  <div className="reel-creator-meta">
                    <strong>{campaign.ownerName}</strong>
                    <span>{compactNumber(campaign.views)} просмотров в кампании</span>
                  </div>
                </div>
                <h2><Link href={`/campaigns/${campaign.id}?returnTo=%2Ffeed`}>{campaign.title}</Link></h2>
                <div className="reel-pay-row">
                  {mode === "worker" ? (
                    <>
                      <b>до {rub(expected)}</b>
                      <span>{guarantee > 0 ? `гарантия ${rub(guarantee)} · ` : ""}{days} дн.</span>
                    </>
                  ) : (
                    <>
                      <b>{compactNumber(campaign.views)}</b>
                      <span>{campaign.submissions} роликов в кампании</span>
                    </>
                  )}
                </div>
                <Link className="btn btn-primary reel-cta" href={`/campaigns/${campaign.id}?returnTo=%2Ffeed`}>
                  {mode === "worker" ? "Смотреть заказ →" : "Открыть кампанию →"}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
