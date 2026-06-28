"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function ChatSearchForm({
  initialValue,
  status,
  role,
  view,
  type
}: {
  initialValue: string;
  status: "all" | "active" | "done";
  role?: string;
  view?: string;
  type?: string;
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
    if (role && role !== "all") params.set("role", role);
    if (view && view !== "all") params.set("view", view);
    if (type && type !== "all") params.set("type", type);
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
