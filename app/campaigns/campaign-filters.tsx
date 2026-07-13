"use client";

import { Bookmark, Check, ChevronDown, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import styles from "./campaign-filters.module.css";

const CATEGORIES = [
  ["all", "Все"],
  ["streams", "Стримы"],
  ["humor", "Юмор"],
  ["games", "Игры"],
  ["business", "Бизнес"]
] as const;

const DEADLINES = [
  ["any", "Любой срок"],
  ["3", "До 3 дней"],
  ["7", "До 7 дней"],
  ["later", "Больше 7 дней"]
] as const;
const SORTS = [
  ["promoted", "Сначала продвижение"],
  ["featured", "Сначала новые"],
  ["rate", "Выше ставка"],
  ["pay", "Выше оплата"],
  ["deadline", "Ближе срок"]
] as const;

type CampaignFiltersProps = {
  query: string;
  category: string;
  deadline: string;
  sort: string;
  resultCount: number;
};

type SavedFilter = {
  id: string;
  category: string;
  deadline: string;
  sort: string;
  label: string;
};

const SAVED_FILTERS_KEY = "reelpay_saved_campaign_filters_v1";

function labelFor(items: readonly (readonly string[])[], value: string) {
  return items.find(([key]) => key === value)?.[1] || value;
}

export function CampaignFilters({ query, category, deadline, sort, resultCount }: CampaignFiltersProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({ category, deadline, sort });
  const draftRef = useRef(draft);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  function updateDraft(next: typeof draft) {
    draftRef.current = next;
    setDraft(next);
  }

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || "[]") as SavedFilter[];
      setSavedFilters(Array.isArray(stored) ? stored.slice(0, 5) : []);
    } catch {
      localStorage.removeItem(SAVED_FILTERS_KEY);
    }
  }, []);

  useEffect(() => {
    const next = { category, deadline, sort };
    draftRef.current = next;
    setDraft(next);
  }, [category, deadline, sort]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  function urlWith(values: Partial<typeof draft> & { q?: string }) {
    const next = new URLSearchParams();
    const nextQuery = values.q === undefined ? query : values.q;
    const current = draftRef.current;
    const nextCategory = values.category ?? current.category;
    const nextDeadline = values.deadline ?? current.deadline;
    const nextSort = values.sort ?? current.sort;
    if (nextQuery) next.set("q", nextQuery);
    if (nextCategory !== "all") next.set("category", nextCategory);
    if (nextDeadline !== "any") next.set("deadline", nextDeadline);
    if (nextSort !== "promoted") next.set("sort", nextSort);
    const search = next.toString();
    return search ? `/campaigns?${search}` : "/campaigns";
  }

  function apply() {
    const target = urlWith(draftRef.current);
    setOpen(false);
    router.push(target);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => router.push(urlWith({ q: String(data.get("q") || "").trim() })));
  }

  function removeFilter(key: keyof typeof draft) {
    const reset = key === "category" ? "all" : key === "deadline" ? "any" : "promoted";
    startTransition(() => router.push(urlWith({ ...draft, [key]: reset })));
  }

  function saveCurrentFilter() {
    const label = [
      draft.category !== "all" ? labelFor(CATEGORIES, draft.category) : "Все темы",
      draft.deadline !== "any" ? labelFor(DEADLINES, draft.deadline) : null,
      draft.sort !== "promoted" ? labelFor(SORTS, draft.sort) : null
    ].filter(Boolean).join(" · ");
    const id = `${draft.category}:${draft.deadline}:${draft.sort}`;
    const next = [{ id, ...draft, label }, ...savedFilters.filter((item) => item.id !== id)].slice(0, 5);
    setSavedFilters(next);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
  }

  function removeSavedFilter(id: string) {
    const next = savedFilters.filter((item) => item.id !== id);
    setSavedFilters(next);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
  }

  const activeFilters = [
    category !== "all" ? { key: "category" as const, label: labelFor(CATEGORIES, category) } : null,
    deadline !== "any" ? { key: "deadline" as const, label: labelFor(DEADLINES, deadline) } : null,
    sort !== "promoted" ? { key: "sort" as const, label: labelFor(SORTS, sort) } : null
  ].filter(Boolean) as Array<{ key: keyof typeof draft; label: string }>;

  return (
    <div className={`campaign-filter-shell ${pending ? "is-pending" : ""}`}>
      <div className="campaign-search-row">
        <form onSubmit={submitSearch}>
          <Search size={19} />
          <input name="q" defaultValue={query} placeholder="Название, автор или ниша" aria-label="Поиск заказов" />
          {query ? (
            <button type="button" onClick={() => startTransition(() => router.push(urlWith({ q: "" })))} aria-label="Очистить поиск">
              <X size={17} />
            </button>
          ) : null}
        </form>
        <button
          className={activeFilters.length ? "has-filters" : ""}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={activeFilters.length ? `Фильтры, выбрано: ${activeFilters.length}` : "Фильтры"}
          title="Фильтры"
        >
          <SlidersHorizontal size={18} />
          <span>Фильтры</span>
          {activeFilters.length ? <b>{activeFilters.length}</b> : <ChevronDown size={16} />}
        </button>
      </div>

      {activeFilters.length ? (
        <div className="campaign-active-filters" aria-label="Активные фильтры">
          {activeFilters.map((filter) => (
            <button type="button" onClick={() => removeFilter(filter.key)} key={filter.key}>
              {filter.label} <X size={14} />
            </button>
          ))}
          <button className="reset" type="button" onClick={() => startTransition(() => router.push(query ? `/campaigns?q=${encodeURIComponent(query)}` : "/campaigns"))}>
            Сбросить
          </button>
        </div>
      ) : null}

      {open ? (
        <>
          <button className="campaign-filter-backdrop" type="button" onClick={() => setOpen(false)} aria-label="Закрыть фильтры" />
          <section className="campaign-filter-panel" role="dialog" aria-modal="true" aria-label="Фильтры заказов">
            <header>
              <div>
                <span>Подбор заказов</span>
                <h2>Фильтры</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={20} /></button>
            </header>

            {savedFilters.length ? (
              <fieldset>
                <legend>Сохранённые подборки</legend>
                <div className="campaign-filter-options">
                  {savedFilters.map((filter) => (
                    <span className={styles.saved} key={filter.id}>
                      <button type="button" onClick={() => updateDraft({ category: filter.category, deadline: filter.deadline, sort: filter.sort })}>
                        <Bookmark size={14} /> {filter.label}
                      </button>
                      <button type="button" onClick={() => removeSavedFilter(filter.id)} aria-label={`Удалить подборку ${filter.label}`}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <fieldset>
              <legend>Категория</legend>
              <div className="campaign-filter-options">
                {CATEGORIES.map(([key, label]) => (
                  <button className={draft.category === key ? "active" : ""} type="button" onClick={() => updateDraft({ ...draftRef.current, category: key })} key={key}>
                    {label}{draft.category === key ? <Check size={15} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Срок до дедлайна</legend>
              <div className="campaign-filter-options">
                {DEADLINES.map(([key, label]) => (
                  <button className={draft.deadline === key ? "active" : ""} type="button" onClick={() => updateDraft({ ...draftRef.current, deadline: key })} key={key}>
                    {label}{draft.deadline === key ? <Check size={15} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Сортировка</legend>
              <div className="campaign-filter-options">
                {SORTS.map(([key, label]) => (
                  <button className={draft.sort === key ? "active" : ""} type="button" onClick={() => updateDraft({ ...draftRef.current, sort: key })} key={key}>
                    {label}{draft.sort === key ? <Check size={15} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <footer>
              <button type="button" onClick={saveCurrentFilter}><Bookmark size={14} /> Сохранить</button>
              <button className="apply" type="button" onClick={apply}>
                Применить{resultCount ? ` · ${resultCount}` : ""}
              </button>
            </footer>
          </section>
        </>
      ) : null}
    </div>
  );
}
