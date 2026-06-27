"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Filter = "all" | "active" | "done";

export function ChatFilterNav({
  current,
  links
}: {
  current: Filter;
  links: Record<Filter, string>;
}) {
  const [pending, setPending] = useState<Filter | null>(null);

  useEffect(() => {
    setPending(null);
  }, [current]);

  const selected = pending || current;

  return (
    <nav className="chat-filters" aria-label="Фильтр чатов" aria-busy={Boolean(pending)}>
      {([
        ["all", "Все"],
        ["active", "В работе"],
        ["done", "Завершены"]
      ] as const).map(([value, label]) => (
        <Link
          className={selected === value ? "active" : ""}
          href={links[value]}
          key={value}
          prefetch
          onClick={() => setPending(value)}
        >
          {label}
          {pending === value ? <i aria-hidden="true" /> : null}
        </Link>
      ))}
    </nav>
  );
}
