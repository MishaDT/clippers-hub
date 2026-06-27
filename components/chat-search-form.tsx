"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function ChatSearchForm({
  initialValue,
  status
}: {
  initialValue: string;
  status: "all" | "active" | "done";
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setValue(initialValue), [initialValue]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    const query = value.trim();
    if (query) params.set("q", query);
    if (status !== "all") params.set("status", status);
    startTransition(() => router.push(params.size ? `/chats?${params}` : "/chats"));
  }

  return (
    <form className={`chat-search ${isPending ? "pending" : ""}`} onSubmit={submit}>
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Человек или заказ"
        aria-label="Поиск чатов"
      />
    </form>
  );
}
