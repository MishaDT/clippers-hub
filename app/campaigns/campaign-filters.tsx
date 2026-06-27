"use client";

import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";

const CATEGORIES = [
  ["all", "Все"],
  ["streams", "Стримы"],
  ["humor", "Юмор"],
  ["games", "Игры"],
  ["business", "Бизнес"]
] as const;

const DIFFICULTIES = ["Любая", "Лёгкая", "Средняя", "Сложная"] as const;
const SORTS = [
  ["featured", "Сначала новые"],
  ["pay", "Выше оплата"],
  ["deadline", "Ближе срок"]
] as const;

type CampaignFiltersProps = {
  query: string;
  category: string;
  difficulty: string;
  sort: string;
  resultCount: number;
};

function labelFor(items: readonly (readonly string[])[], value: string) {
  return items.find(([key]) => key === value)?.[1] || value;
}

export function CampaignFilters({ query, category, difficulty, sort, resultCount }: CampaignFiltersProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({ category, difficulty, sort });

  useEffect(() => {
    setDraft({ category, difficulty, sort });
  }, [category, difficulty, sort]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  function urlWith(values: Partial<typeof draft> & { q?: string }) {
    const next = new URLSearchParams();
    const nextQuery = values.q === undefined ? query : values.q;
    const nextCategory = values.category ?? draft.category;
    const nextDifficulty = values.difficulty ?? draft.difficulty;
    const nextSort = values.sort ?? draft.sort;
    if (nextQuery) next.set("q", nextQuery);
    if (nextCategory !== "all") next.set("category", nextCategory);
    if (nextDifficulty !== "Любая") next.set("difficulty", nextDifficulty);
    if (nextSort !== "featured") next.set("sort", nextSort);
    const search = next.toString();
    return search ? `/campaigns?${search}` : "/campaigns";
  }

  function apply() {
    setOpen(false);
    startTransition(() => router.push(urlWith(draft)));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => router.push(urlWith({ q: String(data.get("q") || "").trim() })));
  }

  function removeFilter(key: keyof typeof draft) {
    const reset = key === "category" ? "all" : key === "difficulty" ? "Любая" : "featured";
    startTransition(() => router.push(urlWith({ ...draft, [key]: reset })));
  }

  const activeFilters = [
    category !== "all" ? { key: "category" as const, label: labelFor(CATEGORIES, category) } : null,
    difficulty !== "Любая" ? { key: "difficulty" as const, label: difficulty } : null,
    sort !== "featured" ? { key: "sort" as const, label: labelFor(SORTS, sort) } : null
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
        <button className={activeFilters.length ? "has-filters" : ""} type="button" onClick={() => setOpen(true)}>
          <SlidersHorizontal size={18} />
          Фильтры
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

            <fieldset>
              <legend>Категория</legend>
              <div className="campaign-filter-options">
                {CATEGORIES.map(([key, label]) => (
                  <button className={draft.category === key ? "active" : ""} type="button" onClick={() => setDraft({ ...draft, category: key })} key={key}>
                    {label}{draft.category === key ? <Check size={15} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Сложность</legend>
              <div className="campaign-filter-options">
                {DIFFICULTIES.map((item) => (
                  <button className={draft.difficulty === item ? "active" : ""} type="button" onClick={() => setDraft({ ...draft, difficulty: item })} key={item}>
                    {item}{draft.difficulty === item ? <Check size={15} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Сортировка</legend>
              <div className="campaign-filter-options">
                {SORTS.map(([key, label]) => (
                  <button className={draft.sort === key ? "active" : ""} type="button" onClick={() => setDraft({ ...draft, sort: key })} key={key}>
                    {label}{draft.sort === key ? <Check size={15} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <footer>
              <button type="button" onClick={() => setDraft({ category: "all", difficulty: "Любая", sort: "featured" })}>Сбросить</button>
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
