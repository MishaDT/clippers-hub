import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole, Sparkles, Star, Trophy } from "lucide-react";
import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ACHIEVEMENTS, achievementProgress, formatRp } from "@/lib/achievements";
import { loadAchievementStats } from "@/lib/achievement-stats";
import { LEAGUES, leagueForViews, leagueProgress, nextLeague } from "@/lib/leagues";
import { compactNumber } from "@/lib/money";
import { getActiveRoleMode } from "@/lib/role-mode";

export const metadata: Metadata = {
  title: "Достижения и прогресс",
  description: "Лиги, уровни и достижения ReelPay."
};

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireUser();
  const mode = await getActiveRoleMode(user);
  const stats = await loadAchievementStats(user);
  const achievements = ACHIEVEMENTS
    .filter((item) => item.role === "any" || item.role === mode)
    .map((item) => ({ ...item, ...achievementProgress(item, stats) }))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return b.pct - a.pct;
    });
  const currentLeague = leagueForViews(user.lifetimeViews);
  const upcomingLeague = nextLeague(user.lifetimeViews);
  const levelSize = 100_000;
  const level = Math.floor(user.lifetimeViews / levelSize) + 1;
  const levelValue = user.lifetimeViews % levelSize;

  return (
    <AppShell>
      <main className="section progress-page">
        <Link className="progress-back" href="/leaderboard"><ArrowLeft size={16} /> К доске лидеров</Link>

        <header className="progress-hero">
          <span><Sparkles size={16} /> Твой путь в ReelPay</span>
          <h1>Достижения и прогресс</h1>
          <p>Здесь собраны текущая лига, ближайшие цели и уже полученные награды.</p>
        </header>

        <section className="progress-summary">
          <article className="progress-current-league">
            <span className="progress-big-emoji">{currentLeague.emoji}</span>
            <div>
              <small>Текущая лига</small>
              <h2>{currentLeague.name}</h2>
              <p>{upcomingLeague ? `Следующая ступень — ${upcomingLeague.name}` : "Ты достиг высшей лиги"}</p>
              <div className="progress-wide-bar"><i style={{ width: `${Math.max(3, Math.round(leagueProgress(user.lifetimeViews) * 100))}%` }} /></div>
              <em>{compactNumber(user.lifetimeViews)} просмотров</em>
            </div>
          </article>
          <article className="progress-level-card">
            <span><Trophy size={18} /> Уровень</span>
            <strong>{level}</strong>
            <div className="progress-wide-bar"><i style={{ width: `${Math.max(3, Math.round((levelValue / levelSize) * 100))}%` }} /></div>
            <em>{compactNumber(levelValue)} / {compactNumber(levelSize)} XP</em>
          </article>
        </section>

        {mode === "worker" ? (
          <section className="progress-section">
            <header><div><small>Лиги</small><h2>Путь от новичка до легенды</h2></div></header>
            <div className="progress-league-grid">
              {LEAGUES.map((league) => {
                const reached = user.lifetimeViews >= league.min;
                const active = league.key === currentLeague.key;
                return (
                  <article className={`${active ? "active" : ""} ${reached ? "reached" : ""}`} key={league.key}>
                    <span>{league.emoji}</span>
                    <div><strong>{league.name}</strong><small>от {compactNumber(league.min)} просмотров</small></div>
                    {reached ? <CheckCircle2 size={18} /> : <LockKeyhole size={18} />}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="progress-section">
          <header>
            <div><small>Ачивки</small><h2>Ближайшая цель — первая</h2></div>
            <span>{achievements.filter((item) => item.done).length} / {achievements.length} получено</span>
          </header>
          <div className="progress-achievement-grid">
            {achievements.map((item, index) => (
              <article className={`${item.done ? "done" : ""} ${index === 0 && !item.done ? "nearest" : ""}`} key={item.code}>
                <span className="progress-achievement-icon">{item.done ? <CheckCircle2 size={20} /> : <Star size={20} />}</span>
                <div>
                  <small>{index === 0 && !item.done ? "Ближайшая цель" : item.done ? "Выполнено" : `Награда ${formatRp(item.reward)}`}</small>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <div className="progress-wide-bar"><i style={{ width: `${Math.max(item.pct ? 3 : 0, item.pct)}%` }} /></div>
                  <em>{compactNumber(item.value)} / {compactNumber(item.target)}</em>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
