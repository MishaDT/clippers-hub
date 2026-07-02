"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { BriefcaseBusiness, RefreshCw, Zap } from "lucide-react";
import { switchRoleAction } from "@/app/actions";

export function RoleModeSwitcher({ mode }: { mode: "client" | "worker" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;
  const target = mode === "client" ? "worker" : "client";
  const Icon = mode === "client" ? BriefcaseBusiness : Zap;

  return (
    <form action={switchRoleAction}>
      <input type="hidden" name="mode" value={target} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        className="role-pill"
        type="submit"
        title={`Переключить на ${target === "client" ? "заказчика" : "исполнителя"}`}
      >
        <Icon size={16} />
        <span>{mode === "client" ? "Заказчик" : "Исполнитель"}</span>
        <RefreshCw size={12} />
      </button>
    </form>
  );
}
