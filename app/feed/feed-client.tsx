"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Bookmark, Flame, Heart, Send, Target, TrendingUp, UsersRound } from "lucide-react";
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

  const visible = useMemo(() => {
    const list = [...campaigns];
    if (activeTab === "Тренды") {
      return list.sort((a, b) => b.views - a.views).slice(0, 12);
    }
    return list;
  }, [activeTab, campaigns]);

  async function shareCampaign(campaign: FeedCampaign, fallbackCount: number) {
    const url = `${window.location.origin}/campaigns/${campaign.id}`;
    setShared((value) => ({ ...value, [campaign.id]: (value[campaign.id] || fallbackCount) + 1 }));

    if (navigator.share) {
      await navigator.share({
        title: campaign.title,
        text: "Посмотри заказ в ReelPay",
        url
      }).catch(() => undefined);
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
      void toggleCampaignReactionAction(campaignId, kind).then((state) => {
        setter((value) => ({ ...value, [campaignId]: state }));
      }).catch(() => {
        setter((value) => ({ ...value, [campaignId]: current }));
      });
    });
  }

  return (
    <>
      <div className="feed-tabs" role="tablist" aria-label="Лента">
        {tabs.map((tab) => (
          <button className={activeTab === tab ? "active" : ""} type="button" onClick={() => setActiveTab(tab)} key={tab}>
            {tab === "Тренды" ? <Flame size={17} /> : null}
            {tab}
          </button>
        ))}
      </div>

      <div className="big-card-feed">
        {visible.map((campaign, index) => {
          const progress = Math.min(100, Math.round((campaign.views / Math.max(campaign.viewThreshold, 1)) * 100));
          const expected = Math.round((campaign.viewThreshold / 1000) * campaign.cpmRateCents * 0.89);
          const isLiked = Boolean(liked[campaign.id]);
          const isSaved = Boolean(saved[campaign.id]);
          return (
            <article className="big-order-card" key={campaign.id}>
              <video className="feed-video" src={campaign.video} poster={campaign.cover} autoPlay muted loop playsInline preload="metadata" />
              <div className="video-shade" />
              <div className="order-creator">
                <div className="creator-avatar small"><img src={campaign.ownerAvatar} alt="" /></div>
                <div><strong>{campaign.ownerName}</strong><span>{compactNumber(campaign.views || 128000)} подписчиков</span></div>
              </div>
              <div className="order-float pay">до {rub(expected)}<span>за выполнение</span></div>
              <div className="order-float goal"><Target size={18} /> цель: {compactNumber(campaign.viewThreshold)}<span>просмотров</span></div>
              <div className="order-actions">
                <button className={isLiked ? "active like" : ""} type="button" disabled={isPending} onClick={() => toggleReaction(campaign.id, "LIKE")}>
                  <Heart size={24} fill={isLiked ? "#f43f8f" : "none"} color={isLiked ? "#f43f8f" : "currentColor"} />
                  <small>{(2.1 + index / 10 + (isLiked ? 0.1 : 0)).toFixed(1)}K</small>
                </button>
                <button className={isSaved ? "active" : ""} type="button" disabled={isPending} onClick={() => toggleReaction(campaign.id, "SAVE")}>
                  <Bookmark size={24} fill={isSaved ? "currentColor" : "none"} />
                  <small>{900 + index * 23}</small>
                </button>
                <button type="button" onClick={() => void shareCampaign(campaign, 240 + index * 7)}>
                  <Send size={24} />
                  <small>{shared[campaign.id] || 240 + index * 7}</small>
                </button>
              </div>
              <div className="big-order-info">
                <h2>{campaign.title}</h2>
                <p>{campaign.description}</p>
                <div className="actions">
                  <span className="tag">{campaign.niche || "Нарезка"}</span>
                  <span className="tag soft">{Math.max(1, Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86400000))} дня</span>
                </div>
                <div className="feed-progress">
                  <div><UsersRound size={22} /><strong>{campaign.submissions}</strong><span>исполнителей</span></div>
                  <div><TrendingUp size={22} /><strong>{compactNumber(campaign.views)} / {compactNumber(campaign.viewThreshold)}</strong><span>прогресс цели · {progress}%</span></div>
                  <Link className="btn btn-primary" href={`/campaigns/${campaign.id}`}>Смотреть заказ →</Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
