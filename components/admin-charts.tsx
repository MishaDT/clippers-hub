import type { CSSProperties } from "react";
import styles from "./admin-charts.module.css";

type Point = { label: string; value: number };

export function AdminBarChart({
  title,
  value,
  points,
  tone = "lime"
}: {
  title: string;
  value: string;
  points: Point[];
  tone?: "lime" | "blue" | "orange" | "violet";
}) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const empty = points.every((point) => point.value <= 0);
  const toneClass = tone === "blue" ? styles.blue : tone === "orange" ? styles.orange : tone === "violet" ? styles.violet : "";
  return (
    <article className={`${styles.chart} ${toneClass}`}>
      <header><span>{title}</span><strong>{value}</strong></header>
      {empty ? <div className={styles.empty}>За этот период данных пока нет</div> : <div className={styles.plot} role="img" aria-label={title}>
        {points.map((point) => (
          <span className={styles.column} key={point.label} title={`${point.label}: ${point.value}`}>
            <span className={styles.barTrack}>
              <i
                className={styles.bar}
                data-zero={point.value <= 0}
                style={{ "--bar-height": `${Math.max(8, Math.round((point.value / max) * 100))}%` } as CSSProperties}
              />
            </span>
            <small>{point.label}</small>
          </span>
        ))}
      </div>}
    </article>
  );
}
