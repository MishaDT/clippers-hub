"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function MarketplacePagination({ page, totalPages, previousHref, nextHref }: { page: number; totalPages: number; previousHref: string; nextHref: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(href: string) {
    startTransition(() => {
      router.push(href, { scroll: false });
      window.setTimeout(() => document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    });
  }

  return (
    <nav className="mk-pages" aria-label="Страницы заказов" data-loading={pending}>
      <button disabled={page <= 1 || pending} onClick={() => go(previousHref)}>Назад</button>
      <span>{pending ? "Загрузка…" : `${page} / ${totalPages}`}</span>
      <button disabled={page >= totalPages || pending} onClick={() => go(nextHref)}>Дальше</button>
    </nav>
  );
}
