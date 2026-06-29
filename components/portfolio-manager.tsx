"use client";

import { ArrowDown, ArrowUp, Search, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

type Work = { id: string; currentViews: number; campaign: { title: string } };
type Pin = { id: string; submissionId: string; position: number; submission: Work };

export function PortfolioManager({ initialPins, automatic }: { initialPins: Pin[]; automatic: Work[] }) {
  const [pins, setPins] = useState(initialPins);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(automatic);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/profile/portfolio?q=${encodeURIComponent(query)}&page=${page}`);
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.items);
      setTotalPages(data.totalPages);
    }, 180);
    return () => clearTimeout(timer);
  }, [open, page, query]);

  function mutate(payload: Record<string, string>) {
    startTransition(async () => {
      const response = await fetch("/api/profile/portfolio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.pins) setPins(data.pins);
    });
  }

  const pinnedIds = new Set(pins.map((pin) => pin.submissionId));
  const preview = pins.length ? pins.map((pin) => pin.submission) : automatic.slice(0, 6);

  return (
    <section className="portfolio-console">
      <div className="portfolio-summary">
        <div><h2>Витрина работ</h2><p>По умолчанию показываем лучшие работы. Здесь можно заменить их вручную.</p></div>
        <button className="btn btn-small" type="button" onClick={() => setOpen(true)}><Settings2 size={16} /> Настроить</button>
      </div>
      <div className="portfolio-preview">
        {preview.map((item, index) => <article key={item.id}><span>{index + 1}</span><div><b>{item.campaign.title}</b><small>{item.currentViews.toLocaleString("ru-RU")} просмотров</small></div></article>)}
        {!preview.length ? <p className="muted">Подтверждённые работы появятся здесь автоматически.</p> : null}
      </div>
      {open ? <div className="portfolio-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <section className="portfolio-modal" role="dialog" aria-modal="true" aria-label="Настройка витрины">
          <header><div><h2>Настройка витрины</h2><p>{pins.length}/6 закреплено вручную</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><X /></button></header>
          {pins.length ? <div className="portfolio-pins">{pins.map((pin, index) => <article key={pin.id}><span>{index + 1}</span><div><b>{pin.submission.campaign.title}</b><small>{pin.submission.currentViews.toLocaleString("ru-RU")} просмотров</small></div><button onClick={() => mutate({ action: "move", pinId: pin.id, direction: "up" })} disabled={pending || index === 0} aria-label="Поднять"><ArrowUp size={16} /></button><button onClick={() => mutate({ action: "move", pinId: pin.id, direction: "down" })} disabled={pending || index === pins.length - 1} aria-label="Опустить"><ArrowDown size={16} /></button><button onClick={() => mutate({ action: "remove", pinId: pin.id })} disabled={pending} aria-label="Убрать"><Trash2 size={16} /></button></article>)}</div> : <p className="portfolio-auto-note">Сейчас витрина заполняется автоматически.</p>}
          <label className="portfolio-search"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Найти подтверждённую работу" /></label>
          <div className="portfolio-results">{items.map((item) => <article key={item.id}><div><b>{item.campaign.title}</b><small>{item.currentViews.toLocaleString("ru-RU")} просмотров</small></div><button className="btn btn-small" type="button" disabled={pending || pinnedIds.has(item.id) || pins.length >= 6} onClick={() => mutate({ action: "pin", submissionId: item.id })}>{pinnedIds.has(item.id) ? "Добавлено" : "Добавить"}</button></article>)}</div>
          <nav className="portfolio-pages"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Назад</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Дальше</button></nav>
        </section>
      </div> : null}
    </section>
  );
}
