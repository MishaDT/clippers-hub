import { compactNumber } from "@/lib/money";
import { parseJson } from "@/lib/json";
import styles from "./clip-velocity-chart.module.css";

type Point = { at?: string; from?: number; to?: number };

export function ClipVelocityChart({ data }: { data: string }) {
  const raw = parseJson<Point[]>(data, [])
    .filter((point) => Number.isFinite(point.to))
    .slice(-20);
  if (raw.length < 2) {
    return <div className={styles.chart}><div className={styles.empty}>График появится после двух обновлений статистики</div></div>;
  }

  const values = raw.map((point) => Math.max(0, Number(point.to || 0)));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 320;
  const height = 54;
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className={styles.chart}>
      <header><b>Динамика просмотров</b><span>{compactNumber(min)} → {compactNumber(max)}</span></header>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Просмотры выросли с ${min} до ${max}`}>
        <line x1="0" y1={height - 1} x2={width} y2={height - 1} />
        <polyline points={points} />
      </svg>
    </div>
  );
}
