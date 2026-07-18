import { Scale } from "lucide-react";
import styles from "./submission-dispute.module.css";

type Dispute = {
  id: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: Date;
  user: { name: string };
};

const labels: Record<string, string> = {
  OPEN: "На рассмотрении",
  RESOLVED_ACCEPTED: "Апелляция удовлетворена",
  RESOLVED_REJECTED: "Апелляция отклонена"
};

export function SubmissionDispute({
  submissionId,
  campaignId,
  disputes,
  canOpen
}: {
  submissionId: string;
  campaignId: string;
  disputes: Dispute[];
  canOpen: boolean;
}) {
  const hasOpen = disputes.some((item) => item.status === "OPEN");

  return (
    <details className={styles.box} open={hasOpen}>
      <summary className={styles.summary}>
        <Scale size={14} />
        Спор и апелляция
        {hasOpen ? <span className={styles.open}>Выплата остановлена</span> : null}
      </summary>

      {disputes.length ? (
        <div className={styles.history}>
          {disputes.map((item) => (
            <article className={styles.case} key={item.id}>
              <header>
                <b>{labels[item.status] || item.status} · {item.user.name}</b>
                <time>{item.createdAt.toLocaleString("ru-RU")}</time>
              </header>
              <p>{item.reason}</p>
              {item.resolution ? <p><b>Решение:</b> {item.resolution}</p> : null}
            </article>
          ))}
        </div>
      ) : null}

      {canOpen && !hasOpen ? (
        <form className={styles.form} action="/api/disputes/open" method="post">
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="returnTo" value={`/campaigns/${campaignId}`} />
          <label htmlFor={`dispute-${submissionId}`}>Почему решение нужно пересмотреть?</label>
          <textarea
            id={`dispute-${submissionId}`}
            name="reason"
            minLength={20}
            maxLength={1000}
            required
            placeholder="Опишите факт: что было выполнено по брифу и с каким решением вы не согласны"
          />
          <small>Администратор увидит бриф, статистику и проверки. Пока спор открыт, соответствующая выплата не выдаётся.</small>
          <button type="submit">Открыть апелляцию</button>
        </form>
      ) : null}
    </details>
  );
}
