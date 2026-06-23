import Link from "next/link";

export default function NotFound() {
  return (
    <div className="route-error">
      <h1>Страница не найдена</h1>
      <p className="muted">Возможно, ссылка устарела. Вернись в ленту или на главную.</p>
      <div className="actions">
        <Link className="btn btn-primary" href="/feed">В ленту</Link>
        <Link className="btn btn-ghost" href="/">На главную</Link>
      </div>
    </div>
  );
}
