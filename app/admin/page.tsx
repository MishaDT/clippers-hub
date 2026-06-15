import { AppShell, Card, Stat, Tag } from "@/components/ui";
import { syncViewsAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compactNumber } from "@/lib/money";

export default async function AdminPage() {
  const user = await requireUser();
  const flagged = await prisma.submission.findMany({
    where: { fraudScore: { gte: 70 } },
    include: { worker: true, campaign: true },
    orderBy: { fraudScore: "desc" }
  });
  const pending = await prisma.submission.count({ where: { status: { in: ["THRESHOLD_MET", "SETTLING"] } } });
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <AppShell>
      <section className="section">
        <span className="eyebrow">Admin</span>
        <h1>Fraud queue и системные операции.</h1>
        {user.role !== "ADMIN" ? <p className="muted">Текущий пользователь не админ, но страница доступна локально для проверки MVP.</p> : null}
      </section>
      <section className="section grid grid-3">
        <Stat value={flagged.length} label="fraud queue" tone={flagged.length ? "bad" : "good"} />
        <Stat value={pending} label="settlement queue" />
        <Stat value={logs.length} label="audit logs" />
      </section>
      <section className="section grid grid-2">
        <Card>
          <div className="actions"><h2>Очередь фрода</h2><form action={syncViewsAction}><button className="btn btn-small" type="submit">Run sync</button></form></div>
          {flagged.length ? flagged.map((submission) => (
            <div className="row" key={submission.id}><div><strong>{submission.trackingCode}</strong><p className="small">@{submission.worker.handle} · {submission.campaign.title} · {compactNumber(submission.currentViews)} views</p></div><Tag tone="warn">{submission.fraudScore}/100</Tag></div>
          )) : <p className="muted">Нет публикаций с fraud score выше 70.</p>}
        </Card>
        <Card>
          <h2>Audit log</h2>
          {logs.map((log) => <div className="row" key={log.id}><div><strong>{log.action}</strong><p className="small">{log.entity} · {log.createdAt.toLocaleString("ru-RU")}</p></div><Tag>{log.entityId}</Tag></div>)}
        </Card>
      </section>
    </AppShell>
  );
}
