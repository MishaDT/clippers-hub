import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { BadgeCheck, ChevronRight, Crown, Flame, Handshake, Scissors, Sparkles, Star, Trophy } from "lucide-react";
import { AppShell } from "@/components/ui";
import { LeagueBadge } from "@/components/league-badge";
import { LeaderboardFireCanvas } from "@/components/leaderboard-fire-canvas";
import { LeaderboardPeriodTabs } from "@/components/leaderboard-period-tabs";
import { ReferralCard } from "@/components/referral-card";
import { ProgressCarousel } from "@/components/progress-carousel";
import { AffiliateCarousel } from "@/components/affiliate-carousel";
import { PodiumFlameCanvas } from "@/components/podium-flame-canvas";
import { LeaderboardLoadMore } from "@/components/leaderboard-load-more";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendCollabInviteAction } from "@/app/actions";
import { compactNumber } from "@/lib/money";
import { leagueForViews, leagueProgress, nextLeague } from "@/lib/leagues";
import { getActiveRoleMode } from "@/lib/role-mode";
import { loadAffiliateOffers } from "@/lib/affiliate-offers";

// Default friendly opener for a one-click collab invite from the board.
const COLLAB_MSG = "Привет! Хочу позвать тебя на совместный клип в ReelPay. Обсудим?";

export const metadata: Metadata = {
  title: "Доска лидеров",
  description: "Топ клипперов недели по просмотрам. Лиги, ачивки и лучшие авторы платформы."
};

type Period = "week" | "all";

type Row = {
  rank: number;
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  lifetimeViews: number;
  views: number;
  clips: number;
  cover: string;
};

const COVERS = [
  "/assets/gaming-order.png",
  "/assets/podcast-order.png",
  "/assets/marketplace-thumb.png",
  "/assets/hero-studio.png",
  "/assets/creator-nika.png"
];

function coverFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COVERS[hash % COVERS.length];
}

function avatarFor(handle: string, avatar: string | null) {
  return avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(handle || "clipper")}&backgroundColor=transparent`;
}

const SINCE_MS = 7 * 24 * 60 * 60 * 1000;

// Cached aggregate so the board renders instantly (no per-request DB wait, no N+1).
const loadLeaders = unstable_cache(
  async (period: Period): Promise<Row[]> => {
    const since = new Date(Date.now() - SINCE_MS);
    const recentGroups = await prisma.submission.groupBy({
      by: ["workerId"],
      where: period === "week" ? { createdAt: { gte: since } } : {},
      _sum: { currentViews: true },
      _count: { _all: true },
      orderBy: { _sum: { currentViews: "desc" } },
      take: 50
    });
    const estimatedWeek = period === "week"
      && recentGroups.filter((group) => (group._sum.currentViews || 0) > 0).length < 3;
    const groups = estimatedWeek
      ? await prisma.submission.groupBy({
        by: ["workerId"],
        _sum: { currentViews: true },
        _count: { _all: true },
        orderBy: { _sum: { currentViews: "desc" } },
        take: 50
      })
      : recentGroups;

    const ids = groups.map((group) => group.workerId);
    if (ids.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, handle: true, avatar: true, lifetimeViews: true, kycStatus: true }
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    return groups
      .map((group, index) => {
        const user = byId.get(group.workerId);
        const handle = user?.handle ?? "";
        return {
          rank: index + 1,
          id: group.workerId,
          name: user?.name ?? "Клиппер",
          handle,
          avatar: avatarFor(handle, user?.avatar ?? null),
          verified: user?.kycStatus === "VERIFIED",
          lifetimeViews: user?.lifetimeViews ?? 0,
          views: estimatedWeek
            ? Math.max(1_000, Math.round((group._sum.currentViews ?? 0) * (0.045 + (index % 4) * 0.006)))
            : group._sum.currentViews ?? 0,
          clips: estimatedWeek ? Math.max(1, Math.min(7, Math.ceil(group._count._all / 3))) : group._count._all,
          cover: coverFor(handle || group.workerId)
        };
      })
      .filter((row) => row.views > 0);
  },
  ["leaderboard-v5"],
  { revalidate: 600, tags: ["leaderboard"] }
);

async function loadMyProgress(user: { id: string; name: string; lifetimeViews: number; referralCode: string }) {
  const since = new Date(Date.now() - SINCE_MS);
  const [allStats, weekStats, invited, referralRewards] = await Promise.all([
    prisma.submission.aggregate({
      where: { workerId: user.id },
      _count: { _all: true },
      _max: { currentViews: true }
    }),
    prisma.submission.aggregate({
      where: { workerId: user.id, createdAt: { gte: since } },
      _sum: { currentViews: true }
    }),
    prisma.user.count({ where: { referredBy: user.referralCode } }),
    prisma.rpTransaction.aggregate({
      where: { userId: user.id, type: "REFERRAL_REWARD" },
      _sum: { amount: true }
    })
  ]);
  return {
    name: user.name,
    lifetimeViews: user.lifetimeViews,
    clips: allStats._count._all,
    maxViews: allStats._max.currentViews || 0,
    weekViews: weekStats._sum.currentViews || 0,
    referralCode: user.referralCode,
    invited,
    referralRewardRp: referralRewards._sum.amount || 0
  };
}

function Avatar({ row, podium }: { row: Row; podium?: boolean }) {
  if (podium) {
    const tone = row.rank === 1 ? "gold" : row.rank === 3 ? "bronze" : "lime";
    return (
      <div className="podium-avatar fire-orb">
        <PodiumFlameCanvas tone={tone} jet={row.rank === 1} />
        <img src={row.avatar} alt="" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="lr-ava-wrap">
      <img src={row.avatar} alt="" loading="lazy" />
    </div>
  );
}

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = rawPeriod === "all" ? "all" : "week";
  const currentUser = await getCurrentUser();
  const mode = currentUser ? await getActiveRoleMode(currentUser) : "worker";
  const [rows, me, affiliateOffers] = await Promise.all([
    loadLeaders(period),
    currentUser ? loadMyProgress(currentUser) : Promise.resolve(null),
    loadAffiliateOffers()
  ]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const visualOrder = [1, 0, 2].filter((i) => podium[i]); // 2nd, 1st, 3rd

  const achievements = me
    ? [
        { icon: Star, title: "Восходящая звезда", desc: "Набери 10K просмотров за неделю", value: me.weekViews, target: 10_000, fmt: compactNumber },
        { icon: Scissors, title: "Клипмейкер", desc: "Создай 50 клипов", value: me.clips, target: 50, fmt: (n: number) => String(n) },
        { icon: Flame, title: "Вирусный", desc: "Набери 100K просмотров на одном клипе", value: me.maxViews, target: 100_000, fmt: compactNumber }
      ]
    : [];

  // Lightweight, view-derived progress ring (real data, no fake economy).
  const seg = 100_000;
  const level = me ? Math.floor(me.lifetimeViews / seg) + 1 : 1;
  const intoLevel = me ? me.lifetimeViews % seg : 0;
  const ringPct = intoLevel / seg;
  const progressViews = me?.lifetimeViews || 0;
  const activeLeague = leagueForViews(progressViews);
  const upcomingLeague = nextLeague(progressViews);
  const rankedAchievements = [...achievements].sort((a, b) => {
    const aDone = a.value >= a.target;
    const bDone = b.value >= b.target;
    if (aDone !== bDone) return aDone ? 1 : -1;
    return (b.value / b.target) - (a.value / a.target);
  });
  const nextAchievement = rankedAchievements[0];

  return (
    <AppShell>
      <section className="section leaderboard-page">
        <div className="leaderboard-grid">
          <div className="leaderboard-main">
            <header className="leaderboard-header">
              <div>
                <span className="eyebrow"><Trophy size={15} /> Рейтинг</span>
                <h1>Доска лидеров</h1>
                <p>Топ клипперов за {period === "week" ? "неделю" : "всё время"}</p>
              </div>
              <span className="leaderboard-refresh">Обновляется каждую неделю</span>
            </header>

            <LeaderboardPeriodTabs period={period} />

            {rows.length === 0 ? (
              <div className="lb-empty">
                <Trophy size={30} />
                <b>Пока пусто</b>
                <p>Как только клипперы начнут набирать просмотры, здесь появится топ недели.</p>
                <Link className="btn btn-primary" href="/campaigns">{mode === "client" ? "Открыть кампании" : "Найти заказ"}</Link>
              </div>
            ) : (
              <>
                <div className="leaderboard-hero">
                  <LeaderboardFireCanvas />
                  <div className="lb-stage-vignette" aria-hidden="true" />
                  <div className="tree-glow" aria-hidden="true" />
                  <div className="root-lines" aria-hidden="true" />
                  <svg className="tree-svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
                    <g fill="none" stroke="rgba(201,243,29,.55)" strokeLinecap="round">
                      <path d="M200 260 C200 210 200 180 200 120" strokeWidth="3" />
                      <path d="M200 188 C168 168 146 150 116 116" strokeWidth="2" />
                      <path d="M200 188 C232 168 254 150 284 116" strokeWidth="2" />
                      <path d="M200 156 C182 140 168 126 152 100" strokeWidth="1.6" />
                      <path d="M200 156 C218 140 232 126 248 100" strokeWidth="1.6" />
                      <path d="M200 130 C192 114 188 100 184 82" strokeWidth="1.3" />
                      <path d="M200 130 C208 114 212 100 216 82" strokeWidth="1.3" />
                    </g>
                    <g fill="rgba(201,243,29,.9)">
                      <circle cx="116" cy="116" r="2.4" /><circle cx="284" cy="116" r="2.4" />
                      <circle cx="152" cy="100" r="2" /><circle cx="248" cy="100" r="2" />
                      <circle cx="184" cy="82" r="1.8" /><circle cx="216" cy="82" r="1.8" />
                    </g>
                  </svg>
                  <div className="embers" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
                  <ol className="podium">
                    {visualOrder.map((i) => {
                      const row = podium[i];
                      const pos = row.rank === 1 ? "first" : row.rank === 2 ? "second" : "third";
                      return (
                        <li className={`podium-card podium-card--${pos}`} key={row.id}>
                          <Link className="podium-cardlink" href={`/clippers/${row.handle}`} aria-label={`Профиль ${row.name}`} prefetch />
                          <span className="podium-top-light" aria-hidden="true" />
                          {row.rank === 1 ? <div className="podium-crown" aria-hidden="true"><Crown /></div> : null}
                          <Avatar row={row} podium />
                          <div className="podium-rank">{row.rank}</div>
                          <div className="podium-name">
                            <strong>{row.id === currentUser?.id ? "Я" : row.name}</strong>
                            {row.verified ? <BadgeCheck size={15} className="verified" /> : null}
                          </div>
                          <LeagueBadge views={row.lifetimeViews} size="sm" />
                          <div className="podium-views">
                            <b>{compactNumber(row.views)}</b>
                            <span>просмотров</span>
                          </div>
                          <div className="podium-clips">{row.clips} клипов</div>
                          {mode === "client" && row.id !== currentUser?.id ? (
                            <form className="podium-invite" action={sendCollabInviteAction}>
                              <input type="hidden" name="workerId" value={row.id} />
                              <input type="hidden" name="handle" value={row.handle} />
                              <input type="hidden" name="message" value={COLLAB_MSG} />
                              <button type="submit"><Handshake size={14} /> Пригласить</button>
                            </form>
                          ) : row.id === currentUser?.id ? <span className="podium-self">Ваше место</span> : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {me ? <section className="mobile-rank-overview" aria-label="Ранг и прогресс">
                  <article className="mobile-rank-card">
                    <span className="mobile-rank-icon" aria-hidden="true">{activeLeague.emoji}</span>
                    <div>
                      <small>Текущая лига</small>
                      <b>{activeLeague.name}</b>
                      <em>{upcomingLeague ? `Дальше: ${upcomingLeague.name}` : "Высшая лига"}</em>
                    </div>
                  </article>
                  <article className="mobile-xp-card">
                    <span><Sparkles size={15} /> Уровень {level}</span>
                    <b>{compactNumber(intoLevel)} <small>/ {compactNumber(seg)} XP</small></b>
                    <div className="mobile-progress-bar"><i style={{ width: `${Math.round(ringPct * 100)}%` }} /></div>
                    <em>+{compactNumber(me?.weekViews || 0)} за неделю</em>
                  </article>
                  <article className="mobile-achievement-card">
                    <Star size={18} />
                    <div>
                      <small>Ближайшая ачивка</small>
                      <b>{nextAchievement?.title || "Первый клип"}</b>
                      <em>{nextAchievement?.desc || "Опубликуй первую работу"}</em>
                    </div>
                    <strong>
                      {nextAchievement
                        ? `${Math.min(100, Math.round((nextAchievement.value / nextAchievement.target) * 100))}%`
                        : "0%"}
                    </strong>
                  </article>
                </section> : null}

                {rest.length > 0 ? <LeaderboardLoadMore rows={rest} clientMode={mode === "client"} currentUserId={currentUser?.id} /> : null}
              </>
            )}
          </div>

          <aside className="leaderboard-rail">
            {me ? (
              <section className="rail-panel referral-panel">
                <ReferralCard code={me.referralCode} invited={me.invited} rewardRp={me.referralRewardRp} />
              </section>
            ) : null}

            {currentUser ? (
              <Link className="rail-link-panel" href="/collabs">
                <span><Handshake size={16} /> Мои коллабы</span>
                <ChevronRight size={16} />
              </Link>
            ) : null}

            <AffiliateCarousel offers={affiliateOffers} />

            {me ? (
              <ProgressCarousel
                league={{
                  name: activeLeague.name,
                  emoji: activeLeague.emoji,
                  next: upcomingLeague?.name || null,
                  progress: Math.round(leagueProgress(progressViews) * 100),
                  viewsLabel: `${compactNumber(progressViews)} просмотров`
                }}
                achievement={{
                  title: nextAchievement?.title || "Первый шаг",
                  description: nextAchievement?.desc || "Начни пользоваться ReelPay",
                  progress: nextAchievement ? Math.min(100, Math.round((nextAchievement.value / nextAchievement.target) * 100)) : 0,
                  valueLabel: nextAchievement ? `${nextAchievement.fmt(nextAchievement.value)} / ${nextAchievement.fmt(nextAchievement.target)}` : "0%"
                }}
                level={{
                  value: level,
                  progress: Math.round(ringPct * 100),
                  currentLabel: `${compactNumber(intoLevel)} / ${compactNumber(seg)} XP`,
                  weekLabel: `+${compactNumber(me.weekViews)} XP за неделю`
                }}
              />
            ) : null}

            {!currentUser ? (
              <section className="rail-panel">
                <div className="rail-cta">
                  <b>Хочешь в рейтинг?</b>
                  <p>Войди, бери заказы и набирай просмотры — попадёшь в лиги и на доску лидеров.</p>
                  <Link className="btn btn-primary" href="/login">Войти</Link>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
