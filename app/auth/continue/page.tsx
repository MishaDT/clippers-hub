import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { parseAuthIntent, safeAuthReturnTo } from "@/lib/auth-intent";
import { AutoRoleForm } from "./auto-role-form";

export default async function AuthContinuePage({ searchParams }: { searchParams: Promise<{ mode?: string; returnTo?: string }> }) {
  await requireUser();
  const params = await searchParams;
  const mode = parseAuthIntent(params.mode);
  if (!mode) redirect("/profile");
  const returnTo = safeAuthReturnTo(params.returnTo, mode);
  return <main className="auth-page"><section className="card auth-card"><h1>Открываем ReelPay</h1><p className="muted">Переключаем рабочий режим без повторного входа.</p><AutoRoleForm mode={mode} returnTo={returnTo} /></section></main>;
}
