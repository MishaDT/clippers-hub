import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Crown, Flame, Trophy } from "lucide-react";
import { AppShell } from "@/components/ui";
import { LeagueBadge } from "@/components/league-badge";
import { prisma } from "@/lib/prisma";
import { compactNumber } from "@/lib/money";

export const metadata: Metadata = {
  title: "Доска лидеров",
  description: "Топ клипперов недели по просмотрам. Лиги, прогресс и лучшие авторы платформы."
};

type Period = "week" | "all";

type Row = {
  rank: number;
  id: string;
  name: string;
  handle: string;
  avatar: string;
  lifetimeViews: number;
  views: number;
  clips: number;
};

function avatarFor(handle: string, avatar: string | null) {
  return avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(handle || "clipper")}`;
}

// Cached aggregate so the board renders instantly (no DB wait per request).
const loadLeaders = unstable_cache(
  async (period: Period): Promise<Row[]> => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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
      select: { id: true, name: true, handle: true, avatar: true, lifetimeViews: true }
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    return groups
      .map((group, index) => {
        const user = byId.get(group.workerId);
        return {
          rank: index + 1,
          id: group.workerId,
          name: user?.name ?? "Клиппер",
          handle: user?.handle ?? "",
          avatar: avatarFor(user?.handle ?? "", user?.avatar ?? null),
          lifetimeViews: user?.lifetimeViews ?? 0,
          views: group._sum.currentViews ?? 0,
          clips: group._count._all
        };
      })
      .filter((row) => row.views > 0);
  },
  ["leaderboard-v1"],
  { revalidate: 600, tags: ["leaderboard"] }
);

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = rawPeriod === "all" ? "all" : "week";
  const rows = await loadLeaders(period);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const order = [1, 0, 2]; // visual podium order: 2nd, 1st, 3rd

  return (
    <AppShell>
      <section className="section lb">
        <header className="lb-head">
          <span className="eyebrow"><Trophy size={15} /> Рейтинг</span>
          <h1>Доска лидеров</h1>
          <p>Топ клипперов по просмотрам. Лучшие за неделю поднимаются в лигах и получают признание.</p>
        </header>

        <nav className="lb-period" aria-label="Период">
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
            <p>Как только клипперы начнут набирать просмотры, здесь появится топ.</p>
            <Link className="btn btn-primary" href="/campaigns">Найти заказ</Link>
          </div>
        ) : (
          <>
            {podium.length > 0 ? (
              <ol className="lb-podium">
                {order
                  .filter((i) => podium[i])
                  .map((i) => {
                    const row = podium[i];
                    return (
                      <li className={`lb-pod lb-pod-${row.rank}`} key={row.id}>
                        <div className="lb-pod-rank">{row.rank === 1 ? <Crown size={16} /> : row.rank}</div>
                        <img className="lb-pod-ava" src={row.avatar} alt="" loading="lazy" />
                        <strong>{row.name}</strong>
                        <LeagueBadge views={row.lifetimeViews} size="sm" />
                        <span className="lb-pod-views">{compactNumber(row.views)} просмотров</span>
                      </li>
                    );
                  })}
              </ol>
            ) : null}

            {rest.length > 0 ? (
              <ol className="lb-list">
                {rest.map((row) => (
                  <li className="lb-row" key={row.id}>
                    <span className="lb-rank">{row.rank}</span>
                    <img className="lb-ava" src={row.avatar} alt="" loading="lazy" />
                    <div className="lb-meta">
                      <strong>{row.name}</strong>
                      <LeagueBadge views={row.lifetimeViews} size="sm" />
                    </div>
                    <div className="lb-stats">
                      <b>{compactNumber(row.views)}</b>
                      <em>{row.clips} клип.</em>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}
