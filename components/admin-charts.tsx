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
  return (
    <article className={`admin-chart tone-${tone}`}>
      <header><span>{title}</span><strong>{value}</strong></header>
      <div className="admin-chart-bars" aria-label={title}>
        {points.map((point) => (
          <span key={point.label} title={`${point.label}: ${point.value}`}>
            <i style={{ height: `${Math.max(5, Math.round((point.value / max) * 100))}%` }} />
            <small>{point.label}</small>
          </span>
        ))}
      </div>
    </article>
  );
}
