"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";

type Period = "week" | "all";

export function LeaderboardPeriodTabs({ period }: { period: Period }) {
  const [pending, setPending] = useState<Period | null>(null);

  useEffect(() => setPending(null), [period]);
  const selected = pending || period;

  return (
    <nav className="leaderboard-tabs" aria-label="Период" aria-busy={Boolean(pending)}>
      <Link
        className={selected === "week" ? "active" : ""}
        href="/leaderboard?period=week"
        prefetch
        onClick={() => setPending("week")}
      >
        <Flame size={15} /> За неделю
      </Link>
      <Link
        className={selected === "all" ? "active" : ""}
        href="/leaderboard?period=all"
        prefetch
        onClick={() => setPending("all")}
      >
        За всё время
      </Link>
    </nav>
  );
}
