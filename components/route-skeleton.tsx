// Instant route-transition skeleton. Rendered by app/**/loading.tsx while server components
// fetch, so navigation never looks frozen (especially on a cold database).
export function RouteSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <section className="section route-skeleton" aria-busy="true" aria-label="Загрузка страницы">
      <span className="sk sk-title" />
      <span className="sk sk-sub" />
      <div className="sk-grid">
        {Array.from({ length: cards }).map((_, index) => (
          <span className="sk sk-card" key={index} />
        ))}
      </div>
    </section>
  );
}
