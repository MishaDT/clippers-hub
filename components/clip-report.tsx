import { BadgeCheck, CircleAlert, CircleDashed, OctagonAlert, Radio } from "lucide-react";
import { explainSubmission, type ClipReportInput, type ReasonState } from "@/lib/clip-report";
import { ClipVelocityChart } from "@/components/clip-velocity-chart";
import styles from "./clip-report.module.css";

const stateIcon: Record<ReasonState, typeof BadgeCheck> = {
  ok: BadgeCheck,
  pending: CircleDashed,
  warn: CircleAlert,
  bad: OctagonAlert
};

export function ClipReport({ input, velocity }: { input: ClipReportInput; velocity?: string }) {
  const report = explainSubmission(input);
  return (
    <section className={styles.report} data-tone={report.tone} aria-label="Отчёт по клипу">
      <header className={styles.head}>
        <div>
          <b>{report.headline}</b>
          <span><Radio size={13} /> {report.tracking}</span>
        </div>
      </header>
      <ul className={styles.reasons}>
        {report.reasons.map((reason) => {
          const Icon = stateIcon[reason.state];
          return (
            <li key={reason.label} data-state={reason.state}>
              <Icon size={16} />
              <div><b>{reason.label}</b><span>{reason.text}</span></div>
            </li>
          );
        })}
      </ul>
      {velocity ? <ClipVelocityChart data={velocity} /> : null}
    </section>
  );
}
