import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Play, ShieldCheck, Sparkles } from "lucide-react";
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
      <section className="auth-stage">
        <div className="auth-brand">
          <span className="brand-word">Reel<span>Pay</span></span>
          <p>Биржа коротких видео, где заказчик платит за результат, а клиппер видит весь процесс.</p>
        </div>

        <div className="auth-showcase" aria-hidden="true">
          <div className="motion-card card-a">
            <span><Play size={18} fill="currentColor" /></span>
            <strong>12 840</strong>
            <small>просмотров за 2 часа</small>
          </div>
          <div className="motion-card card-b">
            <span><Sparkles size={18} /></span>
            <strong>+8 700 ₽</strong>
            <small>ожидает проверки</small>
          </div>
          <div className="auth-phone">
            <div className="auth-video-strip">
              <i />
              <i />
              <i />
            </div>
            <div className="auth-task">
              <b>Нарезка стрима</b>
              <span>цель 10K · дедлайн 3 дня</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card auth-card auth-card-new">
        <span className="eyebrow">Вход</span>
        <h1>Вернуться к заказам</h1>
        <p className="muted">Тестовый вход уже заполнен. Можно сразу нажать “Войти” и посмотреть живой кабинет.</p>

        {errorText ? (
          <div className="auth-error" role="alert">
            <AlertCircle size={16} /> {errorText}
          </div>
        ) : null}

        <form className="form" action="/api/auth/login" method="post">
          <label className="field">Email<input name="email" type="email" defaultValue="anya@clippers.local" required /></label>
          <label className="field">Пароль<input name="password" type="password" defaultValue="password123" required /></label>
          <button className="btn btn-primary" type="submit">Войти <ArrowRight size={18} /></button>
        </form>

        <SocialAuth mode="login" />

        <div className="auth-hints">
          <span><CheckCircle2 size={16} /> anya@clippers.local</span>
          <span><ShieldCheck size={16} /> nikita@clippers.local</span>
        </div>
        <p className="small">Нет аккаунта? <Link href="/register">Зарегистрироваться</Link></p>
        <p className="auth-legal">
          Входя, вы принимаете <Link href="/legal/terms">Условия</Link> и{" "}
          <Link href="/legal/privacy">Политику конфиденциальности</Link>.
        </p>
      </section>
    </main>
  );
}
