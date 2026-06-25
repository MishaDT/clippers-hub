import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { BadgeCheck, ChevronRight, Crown, Flame, Play, Scissors, Sparkles, Star, Trophy } from "lucide-react";
import { AppShell } from "@/components/ui";
import { LeagueBadge } from "@/components/league-badge";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { compactNumber } from "@/lib/money";
import { LEAGUES, leagueForViews, leagueProgress, nextLeague } from "@/lib/leagues";

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
  return avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(handle || "clipper")}`;
}

const SINCE_MS = 7 * 24 * 60 * 60 * 1000;

// Cached aggregate so the board renders instantly (no per-request DB wait, no N+1).
const loadLeaders = unstable_cache(
  async (period: Period): Promise<Row[]> => {
    const since = new Date(Date.now() - SINCE_MS);
    const groups = await prisma.submission.groupBy({
      by: ["workerId"],
      where: period === "week" ? { createdAt: { gte: since } } : {},
      _sum: { currentViews: true },
      _count: { _all: true },
      orderBy: { _sum: { currentViews: "desc" } },
      take: 50
    });

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
          views: group._sum.currentViews ?? 0,
          clips: group._count._all,
          cover: coverFor(handle || group.workerId)
        };
      })
      .filter((row) => row.views > 0);
  },
  ["leaderboard-v2"],
  { revalidate: 600, tags: ["leaderboard"] }
);

async function loadMyProgress() {
  const user = await getCurrentUser();
  if (!user) return null;
  const since = new Date(Date.now() - SINCE_MS);
  const subs = await prisma.submission.findMany({
    where: { workerId: user.id },
    select: { currentViews: true, createdAt: true }
  });
  const clips = subs.length;
  const maxViews = subs.reduce((max, s) => Math.max(max, s.currentViews), 0);
  const weekViews = subs.filter((s) => s.createdAt >= since).reduce((sum, s) => sum + s.currentViews, 0);
  return { name: user.name, lifetimeViews: user.lifetimeViews, clips, maxViews, weekViews };
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
  return (
    <div className={podium ? "podium-avatar" : "lr-ava-wrap"}>
      <span className="flame" aria-hidden="true" />
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
  const [rows, me] = await Promise.all([loadLeaders(period), loadMyProgress()]);

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
  const ringR = 52;
  const ringC = 2 * Math.PI * ringR;
  const seg = 100_000;
  const level = me ? Math.floor(me.lifetimeViews / seg) + 1 : 1;
  const intoLevel = me ? me.lifetimeViews % seg : 0;
  const ringPct = intoLevel / seg;

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

            <nav className="leaderboard-tabs" aria-label="Период">
              <Link className={period === "week" ? "active" : ""} href="/leaderboard?period=week">
                <Flame size={15} /> За неделю
              </Link>
              <Link className={period === "all" ? "active" : ""} href="/leaderboard?period=all">
                За всё время
              </Link>
            </nav>

            {rows.length === 0 ? (
              <div className="lb-empty">
                <Trophy size={30} />
                <b>Пока пусто</b>
                <p>Как только клипперы начнут набирать просмотры, здесь появится топ недели.</p>
                <Link className="btn btn-primary" href="/campaigns">Найти заказ</Link>
              </div>
            ) : (
              <>
                <div className="leaderboard-hero">
                  <div className="tree-glow" aria-hidden="true" />
                  <div className="root-lines" aria-hidden="true" />
                  <ol className="podium">
                    {visualOrder.map((i) => {
                      const row = podium[i];
                      const pos = row.rank === 1 ? "first" : row.rank === 2 ? "second" : "third";
                      return (
                        <li className={`podium-card podium-card--${pos}`} key={row.id}>
                          {row.rank === 1 ? <div className="podium-crown" aria-hidden="true">👑</div> : null}
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

                {rest.length > 0 ? (
                  <ol className="leaderboard-table">
                    {rest.map((row) => (
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
                        <Link className="lr-clip" href={`/clippers/${row.handle}`} aria-label="Лучший клип">
                          <img src={row.cover} alt="" loading="lazy" />
                          <span className="lr-clip-play"><Play size={12} fill="#fff" /></span>
                        </Link>
                        <Link className="invite-btn" href={`/clippers/${row.handle}`}>Пригласить на коллаб</Link>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </>
            )}
          </div>

          <aside className="leaderboard-rail">
            <section className="rail-panel">
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
            </section>

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
            ) : (
              <section className="rail-panel">
                <div className="rail-cta">
                  <b>Хочешь в рейтинг?</b>
                  <p>Войди, бери заказы и набирай просмотры — попадёшь в лиги и на доску лидеров.</p>
                  <Link className="btn btn-primary" href="/login">Войти</Link>
                </div>
              </section>
            )}
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
