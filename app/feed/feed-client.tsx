"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bookmark, Flame, Heart, Send } from "lucide-react";
import { toggleCampaignReactionAction } from "@/app/actions";
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

export function FeedClient({ campaigns, likedIds = [], savedIds = [] }: { campaigns: FeedCampaign[]; likedIds?: string[]; savedIds?: string[] }) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Для тебя");
  const [isPending, startTransition] = useTransition();
  const [liked, setLiked] = useState<Record<string, boolean>>(() => Object.fromEntries(likedIds.map((id) => [id, true])));
  const [saved, setSaved] = useState<Record<string, boolean>>(() => Object.fromEntries(savedIds.map((id) => [id, true])));
  const [shared, setShared] = useState<Record<string, number>>({});
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());

  const visible = useMemo(() => {
    const list = [...campaigns];
    if (activeTab === "Тренды") return list.sort((a, b) => b.views - a.views).slice(0, 12);
    return list;
  }, [activeTab, campaigns]);

  // Only the reel snapped into view loads + plays its video; the rest stay paused.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) void video.play().catch(() => undefined);
          else video.pause();
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    videoRefs.current.forEach((video) => observer.observe(video));
    return () => observer.disconnect();
  }, [visible]);

  async function shareCampaign(campaign: FeedCampaign, fallbackCount: number) {
    const url = `${window.location.origin}/campaigns/${campaign.id}`;
    setShared((value) => ({ ...value, [campaign.id]: (value[campaign.id] || fallbackCount) + 1 }));
    if (navigator.share) {
      await navigator.share({ title: campaign.title, text: "Посмотри заказ в ReelPay", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(campaign.title)}`, "_blank", "noopener,noreferrer");
  }

  function toggleReaction(campaignId: string, kind: "LIKE" | "SAVE") {
    const setter = kind === "LIKE" ? setLiked : setSaved;
    const current = kind === "LIKE" ? liked[campaignId] : saved[campaignId];
    setter((value) => ({ ...value, [campaignId]: !current }));
    startTransition(() => {
      void toggleCampaignReactionAction(campaignId, kind)
        .then((state) => setter((value) => ({ ...value, [campaignId]: state })))
        .catch(() => setter((value) => ({ ...value, [campaignId]: current })));
    });
  }

  return (
    <>
      <div className="feed-tabs" role="tablist" aria-label="Лента">
        {tabs.map((tab) => (
          <button className={activeTab === tab ? "active" : ""} type="button" onClick={() => setActiveTab(tab)} key={tab}>
            {tab === "Тренды" ? <Flame size={16} /> : null}
            {tab}
          </button>
        ))}
      </div>

      <div className="reel-feed">
        {visible.map((campaign, index) => {
          const expected = Math.round((campaign.viewThreshold / 1000) * campaign.cpmRateCents * 0.89);
          const days = Math.max(1, Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86400000));
          const isLiked = Boolean(liked[campaign.id]);
          const isSaved = Boolean(saved[campaign.id]);
          return (
            <article className="reel" key={campaign.id}>
              <video
                className="reel-video"
                ref={(el) => {
                  if (el) videoRefs.current.set(campaign.id, el);
                  else videoRefs.current.delete(campaign.id);
                }}
                src={campaign.video}
                poster={campaign.cover}
                muted
                loop
                playsInline
                preload="none"
              />
              <div className="reel-shade" />

              <Link className="reel-pay" href={`/campaigns/${campaign.id}`} aria-label={`Заказ ${campaign.title}`}>
                до {rub(expected)}
                <span>за выполнение</span>
              </Link>

              <div className="reel-rail">
                <button className={isLiked ? "active" : ""} type="button" disabled={isPending} aria-label="Нравится" onClick={() => toggleReaction(campaign.id, "LIKE")}>
                  <span className="ico"><Heart size={22} fill={isLiked ? "#f43f8f" : "none"} color={isLiked ? "#f43f8f" : "#fff"} /></span>
                  <small>{(2.1 + index / 10 + (isLiked ? 0.1 : 0)).toFixed(1)}K</small>
                </button>
                <button className={isSaved ? "active" : ""} type="button" disabled={isPending} aria-label="Сохранить" onClick={() => toggleReaction(campaign.id, "SAVE")}>
                  <span className="ico"><Bookmark size={22} fill={isSaved ? "#fff" : "none"} /></span>
                  <small>{900 + index * 23}</small>
                </button>
                <button type="button" aria-label="Поделиться" onClick={() => void shareCampaign(campaign, 240 + index * 7)}>
                  <span className="ico"><Send size={22} /></span>
                  <small>{shared[campaign.id] || 240 + index * 7}</small>
                </button>
              </div>

              <div className="reel-info">
                <div className="reel-creator-row">
                  <img src={campaign.ownerAvatar} alt="" />
                  <div className="reel-creator-meta">
                    <strong>{campaign.ownerName}</strong>
                    <span>{compactNumber(campaign.views || 128000)} подписчиков · {days} дн.</span>
                  </div>
                </div>
                <h2><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></h2>
                <Link className="btn btn-primary reel-cta" href={`/campaigns/${campaign.id}`}>Смотреть заказ →</Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
