import { AppShell, Card, Stat, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";

export default async function LeaderboardPage() {
  const rows = await prisma.leaderboardSnapshot.findMany({ orderBy: { rank: "asc" } });
  return (
    <AppShell>
      <section className="section">
        <span className="eyebrow">Season 2 · июнь-август 2026</span>
        <h1>Лидерборд клипперов и призовой фонд сезона.</h1>
      </section>
      <section className="section grid grid-4">
        <Stat value="₽480K" label="призовой фонд" />
        <Stat value={compactNumber(rows.reduce((sum, row) => sum + row.views, 0))} label="views сезона" />
        <Stat value={rows.length} label="топ участников" />
        <Stat value="31" label="день до финала" />
      </section>
      <section className="section grid grid-2">
        <Card>
          <h2>Daily live</h2>
          {rows.map((row) => (
            <div className="row" key={row.id}><span className="avatar">{row.rank}</span><div><strong>@{row.handle}</strong><p className="small">{compactNumber(row.views)} views</p></div><strong className="money">{rub(row.payoutCents)}</strong></div>
          ))}
        </Card>
        <Card>
          <h2>Ранги</h2>
          {[
            ["Bronze", "0 views", "15%"],
            ["Silver", "100K views", "13%"],
            ["Gold", "1M views", "11%"],
            ["Diamond", "10M views", "9%"],
            ["Legendary", "100M views", "7%"]
          ].map(([rank, req, fee]) => <div className="row" key={rank}><Tag>{rank}</Tag><span>{req}</span><strong>{fee}</strong></div>)}
        </Card>
      </section>
    </AppShell>
  );
}
