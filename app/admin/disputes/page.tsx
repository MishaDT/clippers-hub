import Link from "next/link";
import { Scale } from "lucide-react";
import { adminResolveDisputeAction } from "@/app/admin/actions";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import styles from "./disputes.module.css";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  OPEN: "Открыт",
  RESOLVED_ACCEPTED: "Удовлетворён",
  RESOLVED_REJECTED: "Отклонён"
};

export default async function AdminDisputesPage({ searchParams }: {
  searchParams: Promise<{ status?: string; error?: string; resolved?: string }>;
}) {
  const params = await searchParams;
  const status = ["OPEN", "RESOLVED_ACCEPTED", "RESOLVED_REJECTED"].includes(String(params.status))
    ? String(params.status)
    : "OPEN";
  const disputes = await prisma.disputeCase.findMany({
    where: { status },
    include: {
      user: { select: { name: true, email: true, handle: true } },
      submission: {
        include: {
          worker: { select: { name: true, handle: true } },
          campaign: { select: { id: true, title: true, owner: { select: { name: true, email: true } } } },
          videoChecks: { orderBy: { createdAt: "desc" }, take: 3 }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Защита сделки"
          title="Споры и апелляции"
          description="Открытый спор блокирует выдачу соответствующей выплаты до решения администратора."
        />

        {params.error ? <div className={`${styles.notice} ${styles.error}`}>Не удалось применить решение: {params.error}.</div> : null}
        {params.resolved ? <div className={styles.notice}>Решение сохранено, стороны получили уведомление.</div> : null}

        <Card className="admin-panel admin-filter-panel">
          <nav className={styles.tabs} aria-label="Статус спора">
            {[
              ["OPEN", "Открытые"],
              ["RESOLVED_ACCEPTED", "Удовлетворённые"],
              ["RESOLVED_REJECTED", "Отклонённые"]
            ].map(([value, label]) => (
              <Link data-active={status === value} href={`/admin/disputes?status=${value}`} key={value}>{label}</Link>
            ))}
          </nav>
        </Card>

        <Card className="admin-panel">
          <div className="moderation-list">
            {disputes.map((dispute) => (
              <details className="moderation-row risk-high" key={dispute.id} open={status === "OPEN"}>
                <summary>
                  <Scale size={16} />
                  <b>{dispute.submission.campaign.title}</b>
                  <span>{statusLabels[dispute.status] || dispute.status}</span>
                  <em>{dispute.user.name}</em>
                  <time>{dispute.createdAt.toLocaleString("ru-RU")}</time>
                </summary>
                <div className="moderation-details">
                  <p>{dispute.reason}</p>
                  <dl>
                    <dt>Автор обращения</dt><dd>{dispute.user.name} · @{dispute.user.handle} · {dispute.user.email}</dd>
                    <dt>Исполнитель</dt><dd>{dispute.submission.worker.name} · @{dispute.submission.worker.handle}</dd>
                    <dt>Заказчик</dt><dd>{dispute.submission.campaign.owner.name} · {dispute.submission.campaign.owner.email}</dd>
                    <dt>Работа</dt><dd>{dispute.submission.status} · {dispute.submission.currentViews.toLocaleString("ru-RU")} просмотров · риск {dispute.submission.fraudScore}%</dd>
                    <dt>Проверки</dt><dd>{dispute.submission.videoChecks.map((check) => `${check.checkType}: ${check.status}`).join(", ") || "Не запускались"}</dd>
                  </dl>
                  <Link href={`/campaigns/${dispute.submission.campaign.id}`}>Открыть комнату сделки</Link>
                  {dispute.status === "OPEN" ? (
                    <form action={adminResolveDisputeAction}>
                      <input type="hidden" name="disputeId" value={dispute.id} />
                      <textarea name="resolution" minLength={10} maxLength={1000} required placeholder="Объясните решение по фактам, брифу и проверкам" />
                      <div>
                        <button name="decision" value="accept">Удовлетворить апелляцию</button>
                        <button className="danger" name="decision" value="reject">Отклонить апелляцию</button>
                      </div>
                    </form>
                  ) : (
                    <p><b>Решение:</b> {dispute.resolution}</p>
                  )}
                </div>
              </details>
            ))}
            {!disputes.length ? <p className="muted">Споров с таким статусом нет.</p> : null}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
