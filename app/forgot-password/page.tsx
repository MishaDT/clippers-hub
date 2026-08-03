import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

const messages: Record<string, { kind: "ok" | "error"; text: string }> = {
  sent: { kind: "ok", text: "Если аккаунт с таким email существует, письмо уже отправлено. Ссылка действует один час." },
  unavailable: { kind: "error", text: "Почтовый сервис временно недоступен. Напишите в поддержку — мы поможем вернуть доступ." },
  invalid: { kind: "error", text: "Не удалось обработать запрос. Обновите страницу и попробуйте ещё раз." }
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "" } = await searchParams;
  const message = messages[status];
  return (
    <main className="auth-page">
      <section className="card auth-card auth-card-new">
        <Link className="brand auth-logo" href="/"><span className="brand-word">Reel<span>Pay</span></span></Link>
        <span className="eyebrow"><Mail size={15} /> Восстановление доступа</span>
        <h1>Забыли пароль?</h1>
        <p className="muted">Введите email аккаунта. Мы отправим одноразовую ссылку для нового пароля.</p>
        {message ? <div className={message.kind === "ok" ? "auth-ref" : "auth-error"} role="status"><ShieldCheck size={17} /><span>{message.text}</span></div> : null}
        <form className="form" action="/api/auth/forgot-password" method="post">
          <label className="field">Email<input name="email" type="email" autoComplete="email" required /></label>
          <button className="btn btn-primary" type="submit"><Mail size={18} /> Отправить ссылку</button>
        </form>
        <p className="small"><Link href="/login"><ArrowLeft size={14} /> Вернуться ко входу</Link></p>
      </section>
    </main>
  );
}
