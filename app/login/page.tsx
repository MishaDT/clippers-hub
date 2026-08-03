import Link from "next/link";
import { AlertCircle, ArrowRight, Play, ShieldCheck, Sparkles } from "lucide-react";
import { SocialAuth, authErrorText } from "@/components/social-auth";
import { getCurrentUser } from "@/lib/auth";
import { safeAuthReturnTo, parseAuthIntent } from "@/lib/auth-intent";
import { getActiveRoleMode } from "@/lib/role-mode";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string | string[]; intent?: string; returnTo?: string; reset?: string }>;
}) {
  const { error, intent, returnTo, reset } = await searchParams;
  const currentUser = await getCurrentUser();
  if (currentUser) {
    const parsedIntent = parseAuthIntent(intent);
    const activeMode = await getActiveRoleMode(currentUser);
    if (parsedIntent && parsedIntent !== activeMode) redirect(`/auth/continue?mode=${parsedIntent}&returnTo=${encodeURIComponent(safeAuthReturnTo(returnTo, parsedIntent))}`);
    redirect(returnTo ? safeAuthReturnTo(returnTo, parsedIntent) : activeMode === "client" ? "/profile" : "/campaigns");
  }
  const errorText = authErrorText(error);

  return (
    <main className="auth-page auth-motion-page">
      <section className="card auth-card auth-card-new">
        <Link className="brand auth-logo" href="/">
          <span className="brand-word">Reel<span>Pay</span></span>
        </Link>

        <span className="eyebrow">Вход по email</span>
        <h1>Вернуться к заказам</h1>
        <p className="muted">Основной способ — email и пароль. Ниже можно выбрать Яндекс, VK ID или Google, если они подключены.</p>

        {errorText ? (
          <div className="auth-error" role="alert">
            <AlertCircle size={16} /> {errorText}
          </div>
        ) : null}

        {reset === "ok" ? (
          <div className="auth-ref" role="status"><ShieldCheck size={16} /> Пароль изменён. Войдите с новым паролем.</div>
        ) : null}

        <form className="form" action="/api/auth/login" method="post">
          <input type="hidden" name="intent" value={intent || ""} />
          <input type="hidden" name="returnTo" value={returnTo || ""} />
          <label className="field">Email<input name="email" type="email" autoComplete="email" required /></label>
          <label className="field">Пароль<input name="password" type="password" autoComplete="current-password" required /></label>
          <p className="small"><Link href="/forgot-password">Забыли пароль?</Link></p>
          <button className="btn btn-primary" type="submit">Войти <ArrowRight size={18} /></button>
        </form>

        <SocialAuth mode="login" intent={intent} returnTo={returnTo} />

        <div className="auth-hints">
          <span><ShieldCheck size={16} /> Защищённая сессия и проверка входа</span>
        </div>

        <p className="small">Нет аккаунта? <Link href={`/register?${new URLSearchParams({ ...(intent ? { intent } : {}), ...(returnTo ? { returnTo } : {}) })}`}>Зарегистрироваться</Link></p>
        <p className="auth-legal">
          Входя, вы принимаете <Link href="/legal/terms">Условия</Link> и{" "}
          <Link href="/legal/privacy">Политику конфиденциальности</Link>.
        </p>
      </section>

      <section className="auth-stage" aria-hidden="true">
        <div className="auth-brand">
          <span className="brand-word">Reel<span>Pay</span></span>
          <p>Заказчики платят за просмотры, клипперы делают короткие ролики и видят весь процесс.</p>
        </div>
        <div className="auth-showcase">
          <div className="motion-card card-a">
            <span><Play size={18} fill="currentColor" /></span>
            <strong>Проверка</strong>
            <small>просмотры через API площадок</small>
          </div>
          <div className="motion-card card-b">
            <span><Sparkles size={18} /></span>
            <strong>Выплата</strong>
            <small>после проверки результата</small>
          </div>
          <div className="auth-phone">
            <div className="auth-video-strip"><i /><i /><i /></div>
            <div className="auth-task">
              <b>Работа по заказу</b>
              <span>текущий статус всегда рядом</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
