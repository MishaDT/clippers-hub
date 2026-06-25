import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, UserPlus } from "lucide-react";
import { SocialAuth, authErrorText } from "@/components/social-auth";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorText = authErrorText(error);

  return (
    <main className="auth-page auth-simple-page">
      <section className="card auth-card auth-card-new">
        <Link className="brand auth-logo" href="/">
          <span className="brand-word">Reel<span>Pay</span></span>
        </Link>

        <span className="eyebrow">Новый аккаунт</span>
        <h1>Начать в ReelPay</h1>
        <p className="muted">Создайте аккаунт за минуту. Роль клиппера или заказчика можно поменять позже в профиле.</p>

        {errorText ? (
          <div className="auth-error" role="alert">
            <AlertCircle size={16} /> {errorText}
          </div>
        ) : null}

        <form className="form" action="/api/auth/register" method="post">
          <label className="field">Имя<input name="name" placeholder="Как тебя зовут" autoComplete="name" required /></label>
          <label className="field">Email<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
          <label className="field">Пароль<input name="password" type="password" placeholder="Лучше длинная фраза" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
          <button className="btn btn-primary" type="submit"><UserPlus size={18} /> Создать аккаунт</button>
        </form>

        <SocialAuth mode="register" />

        <div className="auth-hints">
          <span><CheckCircle2 size={16} /> Бесплатно</span>
          <span><CheckCircle2 size={16} /> Сразу доступ к заказам</span>
        </div>

        <p className="small">Уже есть аккаунт? <Link href="/login">Войти <ArrowRight size={14} /></Link></p>
        <p className="auth-legal">
          Создавая аккаунт, вы принимаете <Link href="/legal/terms">Условия</Link> и{" "}
          <Link href="/legal/privacy">Политику конфиденциальности</Link>.
        </p>
      </section>
    </main>
  );
}
