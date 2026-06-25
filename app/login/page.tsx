import Link from "next/link";
import { AlertCircle, ArrowRight, Play, ShieldCheck, Sparkles } from "lucide-react";
import { SocialAuth, authErrorText } from "@/components/social-auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorText = authErrorText(error);

  return (
    <main className="auth-page auth-motion-page">
      <section className="card auth-card auth-card-new">
        <Link className="brand auth-logo" href="/">
          <span className="brand-word">Reel<span>Pay</span></span>
        </Link>

        <span className="eyebrow">Вход</span>
        <h1>Вернуться к заказам</h1>
        <p className="muted">Войдите по email или через соцсеть. Мы не храним пароли от Google, VK или Yandex.</p>

        {errorText ? (
          <div className="auth-error" role="alert">
            <AlertCircle size={16} /> {errorText}
          </div>
        ) : null}

        <form className="form" action="/api/auth/login" method="post">
          <label className="field">Email<input name="email" type="email" autoComplete="email" required /></label>
          <label className="field">Пароль<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn btn-primary" type="submit">Войти <ArrowRight size={18} /></button>
        </form>

        <SocialAuth mode="login" />

        <div className="auth-hints">
          <span><ShieldCheck size={16} /> Защищённая сессия и проверка входа</span>
        </div>

        <p className="small">Нет аккаунта? <Link href="/register">Зарегистрироваться</Link></p>
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
            <strong>12 840</strong>
            <small>просмотров проверяются</small>
          </div>
          <div className="motion-card card-b">
            <span><Sparkles size={18} /></span>
            <strong>+8 700 ₽</strong>
            <small>ожидает выплаты</small>
          </div>
          <div className="auth-phone">
            <div className="auth-video-strip"><i /><i /><i /></div>
            <div className="auth-task">
              <b>Нарезка стрима</b>
              <span>цель 10K · дедлайн 3 дня</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
