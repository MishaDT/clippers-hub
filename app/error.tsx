"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="route-error">
      <h1>Что-то пошло не так</h1>
      <p className="muted">Похоже, страница не загрузилась. Попробуйте обновить — обычно помогает.</p>
      <div className="actions">
        <button className="btn btn-primary" type="button" onClick={() => reset()}>Обновить</button>
        <a className="btn btn-ghost" href="/">На главную</a>
      </div>
    </div>
  );
}
