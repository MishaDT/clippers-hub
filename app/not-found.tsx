import Link from "next/link";

export default function NotFound() {
  return (
    <div className="route-error">
      <h1>Страница не найдена</h1>
      <p className="muted">Возможно, ссылка устарела. Вернись на главную.</p>
      <div className="actions">
        <Link className="btn btn-primary" href="/campaigns">На главную</Link>
        <Link className="btn btn-ghost" href="/feed">Лента клипов</Link>
      </div>
    </div>
  );
}
