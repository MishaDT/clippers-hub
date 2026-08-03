import Link from "next/link";
import { KeyRound, ShieldAlert } from "lucide-react";

const messages: Record<string, string> = {
  invalid: "Ссылка недействительна или уже использована. Запросите новую.",
  weak_password: "Пароль слишком простой. Используйте длинную фразу, не похожую на ваш email.",
  mismatch: "Пароли не совпадают.",
  limited: "Слишком много попыток. Попробуйте позднее."
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; status?: string }> }) {
  const { token = "", status = "" } = await searchParams;
  const tokenLooksValid = /^[A-Za-z0-9_-]{40,100}$/.test(token);
  const message = messages[status] || (!tokenLooksValid ? messages.invalid : "");
  return (
    <main className="auth-page">
      <section className="card auth-card auth-card-new">
        <Link className="brand auth-logo" href="/"><span className="brand-word">Reel<span>Pay</span></span></Link>
        <span className="eyebrow"><KeyRound size={15} /> Новый пароль</span>
        <h1>Верните доступ</h1>
        <p className="muted">После смены пароля мы завершим все старые сеансы аккаунта.</p>
        {message ? <div className="auth-error" role="alert"><ShieldAlert size={17} /><span>{message}</span></div> : null}
        {tokenLooksValid ? (
          <form className="form" action="/api/auth/reset-password" method="post">
            <input type="hidden" name="token" value={token} />
            <label className="field">Новый пароль<input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
            <label className="field">Повторите пароль<input name="confirmPassword" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></label>
            <button className="btn btn-primary" type="submit"><KeyRound size={18} /> Сохранить пароль</button>
          </form>
        ) : <Link className="btn btn-primary" href="/forgot-password">Запросить новую ссылку</Link>}
        <p className="small"><Link href="/login">Вернуться ко входу</Link></p>
      </section>
    </main>
  );
}
