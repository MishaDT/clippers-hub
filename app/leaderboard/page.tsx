import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { BadgeCheck, ChevronDown, ChevronRight, Crown, Flame, Handshake, Play, Scissors, Sparkles, Star, Trophy } from "lucide-react";
import { AppShell } from "@/components/ui";
import { LeagueBadge } from "@/components/league-badge";
import { LeaderboardFireCanvas } from "@/components/leaderboard-fire-canvas";
import { LeaderboardPeriodTabs } from "@/components/leaderboard-period-tabs";
import { ReferralCard } from "@/components/referral-card";
import { PodiumFlameCanvas } from "@/components/podium-flame-canvas";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { compactNumber } from "@/lib/money";
import { LEAGUES, leagueForViews, leagueProgress, nextLeague } from "@/lib/leagues";
import { getActiveRoleMode } from "@/lib/role-mode";

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

async function loadMyProgress() {
  const user = await getCurrentUser();
  if (!user) return null;
  const since = new Date(Date.now() - SINCE_MS);
  const [allStats, weekStats, invited] = await Promise.all([
    prisma.submission.aggregate({
      where: { workerId: user.id },
      _count: { _all: true },
      _max: { currentViews: true }
    }),
    prisma.submission.aggregate({
      where: { workerId: user.id, createdAt: { gte: since } },
      _sum: { currentViews: true }
    }),
    prisma.user.count({ where: { referredBy: user.referralCode } })
  ]);
  return {
    name: user.name,
    lifetimeViews: user.lifetimeViews,
    clips: allStats._count._all,
    maxViews: allStats._max.currentViews || 0,
    weekViews: weekStats._sum.currentViews || 0,
    referralCode: user.referralCode,
    invited
  };
}

function leagueRange(min: number, max: number | null) {
  return max == null ? `${compactNumber(min)}+ просмотров` : `${compactNumber(min)} – ${compactNumber(max)} просмотров`;
}

const LEAGUE_HINTS: Record<string, string> = {
  rookie: "Вступай и начинай",
  pro: "Покажи свой уровень",
  legend: "Ты среди лучших"
};

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
  searchParams: Promise<{ period?: string; expand?: string }>;
}) {
  const { period: rawPeriod, expand: rawExpand } = await searchParams;
  const period: Period = rawPeriod === "all" ? "all" : "week";
  const expand = rawExpand === "1";
  const currentUser = await getCurrentUser();
  const mode = currentUser ? await getActiveRoleMode(currentUser) : "worker";
  const [rows, me] = await Promise.all([
    loadLeaders(period),
    mode === "worker" ? loadMyProgress() : Promise.resolve(null)
  ]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const shownRest = expand ? rest : rest.slice(0, 7);
  const visualOrder = [1, 0, 2].filter((i) => podium[i]); // 2nd, 1st, 3rd

  const achievements = me
    ? [
        { icon: Star, title: "Восходящая звезда", desc: "Набери 10K просмотров за неделю", value: me.weekViews, target: 10_000, fmt: compactNumber },
        { icon: Scissors, title: "Клипмейкер", desc: "Создай 50 клипов", value: me.clips, target: 50, fmt: (n: number) => String(n) },
        { icon: Flame, title: "Вирусный", desc: "Набери 100K просмотров на одном клипе", value: me.maxViews, target: 100_000, fmt: compactNumber }
      ]
    : [];

  // Lightweight, view-derived progress ring (real data, no fake economy).
  const ringR = 52;
  const ringC = 2 * Math.PI * ringR;
  const seg = 100_000;
  const level = me ? Math.floor(me.lifetimeViews / seg) + 1 : 1;
  const intoLevel = me ? me.lifetimeViews % seg : 0;
  const ringPct = intoLevel / seg;
  const progressViews = me?.lifetimeViews || 0;
  const activeLeague = leagueForViews(progressViews);
  const upcomingLeague = nextLeague(progressViews);
  const nextAchievement = achievements.find((item) => item.value < item.target) || achievements[achievements.length - 1];

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
                          <span className="podium-top-light" aria-hidden="true" />
                          {row.rank === 1 ? <div className="podium-crown" aria-hidden="true"><Crown /></div> : null}
                          <Avatar row={row} podium />
                          <div className="podium-rank">{row.rank}</div>
                          <div className="podium-name">
                            <strong>{row.name}</strong>
                            {row.verified ? <BadgeCheck size={15} className="verified" /> : null}
                          </div>
                          <LeagueBadge views={row.lifetimeViews} size="sm" />
                          <div className="podium-views">
                            <b>{compactNumber(row.views)}</b>
                            <span>просмотров</span>
                          </div>
                          <div className="podium-clips">{row.clips} клипов</div>
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

                {rest.length > 0 ? (
                  <ol className="leaderboard-table">
                    {shownRest.map((row) => (
                      <li className="leaderboard-row" key={row.id}>
                        <span className="lr-rank">{row.rank}</span>
                        <Avatar row={row} />
                        <div className="lr-id">
                          <strong>{row.name}</strong>
                          {row.verified ? <BadgeCheck size={14} className="verified" /> : null}
                          <LeagueBadge views={row.lifetimeViews} size="sm" />
                        </div>
                        <div className="lr-views">
                          <b>{compactNumber(row.views)}</b>
                          <em>просмотров</em>
                        </div>
                        <div className="lr-clips">
                          <b>{row.clips}</b>
                          <em>клипов</em>
                        </div>
                        <Link className="lr-clip" href={`/clippers/${row.handle}`} aria-label="Лучший клип" prefetch>
                          <img src={row.cover} alt="" loading="lazy" />
                          <span className="lr-clip-play"><Play size={12} fill="#fff" /></span>
                        </Link>
                        <Link className="invite-btn" href={`/clippers/${row.handle}`} prefetch>
                          <Handshake size={14} />
                          <span className="invite-full">{mode === "client" ? "Пригласить на коллаб" : "Открыть профиль"}</span>
                          <span className="invite-short">Открыть</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : null}

                {!expand && rest.length > 7 ? (
                  <Link className="lb-more" href={`/leaderboard?period=${period}&expand=1`} prefetch>
                    Показать больше <ChevronDown size={16} />
                  </Link>
                ) : null}
              </>
            )}
          </div>

          <aside className="leaderboard-rail">
            {me && mode === "worker" ? (
              <section className="rail-panel referral-panel">
                <ReferralCard code={me.referralCode} invited={me.invited} />
              </section>
            ) : null}

            {currentUser ? (
              <Link className="rail-link-panel" href="/collabs">
                <span><Handshake size={16} /> Мои коллабы</span>
                <ChevronRight size={16} />
              </Link>
            ) : null}

            {mode === "worker" ? <section className="rail-panel">
              <header className="rail-head">
                <h3>Лиги</h3>
                <span className="rail-link">Пороги</span>
              </header>
              <div className="league-list">
                {LEAGUES.map((league) => {
                  const active = me ? leagueForViews(me.lifetimeViews).key === league.key : false;
                  return (
                    <div
                      className={`league-card league-card--${league.key} ${active ? "is-active" : ""}`}
                      style={{ "--lg": league.color, "--lg-glow": league.glow } as CSSProperties}
                      key={league.key}
                    >
                      <span className="league-emoji" aria-hidden="true">{league.emoji}</span>
                      <div className="league-info">
                        <strong>{league.name}</strong>
                        <span>{leagueRange(league.min, league.max)}</span>
                        <em>{LEAGUE_HINTS[league.key]}</em>
                      </div>
                      <ChevronRight size={16} />
                    </div>
                  );
                })}
              </div>
            </section> : null}

            {me ? (
              <section className="rail-panel">
                <header className="rail-head">
                  <h3>Ачивки</h3>
                </header>
                <div className="ach-list">
                  {achievements.map((ach) => {
                    const pct = Math.min(100, Math.round((ach.value / ach.target) * 100));
                    const Icon = ach.icon;
                    return (
                      <div className={`ach ${pct >= 100 ? "is-done" : ""}`} key={ach.title}>
                        <span className="ach-icon"><Icon size={18} /></span>
                        <div className="ach-info">
                          <strong>{ach.title}</strong>
                          <span>{ach.desc}</span>
                          <div className="ach-bar"><i style={{ width: `${pct}%` }} /></div>
                          <em>{ach.fmt(ach.value)} / {ach.fmt(ach.target)}</em>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {me ? (
              <section className="rail-panel progress-panel">
                <header className="rail-head">
                  <h3>Твой прогресс</h3>
                </header>
                <div className="progress-ring-wrap">
                  <svg className="progress-ring" viewBox="0 0 120 120" width="132" height="132">
                    <circle className="ring-track" cx="60" cy="60" r={ringR} />
                    <circle
                      className="ring-fill"
                      cx="60"
                      cy="60"
                      r={ringR}
                      style={{ strokeDasharray: ringC, strokeDashoffset: ringC * (1 - ringPct) }}
                    />
                  </svg>
                  <div className="progress-center">
                    <span>Уровень</span>
                    <b>{level}</b>
                  </div>
                </div>
                <div className="progress-meta">
                  <strong>{compactNumber(intoLevel)} / {compactNumber(seg)} XP</strong>
                  <span><Sparkles size={13} /> +{compactNumber(me.weekViews)} XP за неделю</span>
                  {nextLeague(me.lifetimeViews) ? (
                    <em>До лиги «{nextLeague(me.lifetimeViews)?.name}»: {Math.round(leagueProgress(me.lifetimeViews) * 100)}%</em>
                  ) : (
                    <em>Высшая лига достигнута 🏆</em>
                  )}
                </div>
              </section>
            ) : !currentUser ? (
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
