import { Flame } from "lucide-react";

type Period = "week" | "all";

export function LeaderboardPeriodTabs({ period }: { period: Period }) {
  return (
    <nav className="leaderboard-tabs" aria-label="Период">
      <a
        className={period === "week" ? "active" : ""}
        href="/leaderboard?period=week"
      >
        <Flame size={15} /> За неделю
      </a>
      <a
        className={period === "all" ? "active" : ""}
        href="/leaderboard?period=all"
      >
        За всё время
      </a>
    </nav>
  );
}
