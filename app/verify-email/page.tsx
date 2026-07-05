import Link from "next/link";
import { CheckCircle2, MailCheck, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { safeReturnTo } from "@/lib/navigation";

const messages: Record<string, { title: string; text: string; good?: boolean }> = {
  sent: {
    title: "Письмо отправлено",
    text: "Откройте письмо от ReelPay и перейдите по ссылке. Она действует 24 часа.",
    good: true
  },
  verified: {
    title: "Email подтверждён",
    text: "Теперь доступны финансовые операции и работа с заказами.",
    good: true
  },
  invalid: {
    title: "Ссылка недействительна",
    text: "Она уже использована или устарела. Запросите новое письмо."
  },
  limited: {
    title: "Слишком много запросов",
    text: "Повторите попытку позже. Это защищает аккаунт от злоупотреблений."
  },
  unavailable: {
    title: "Отправка временно недоступна",
    text: "Почтовый сервис ещё не подключён. Мы не отмечаем email подтверждённым без реальной проверки."
  }
};

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  const { status = "", returnTo: requestedReturnTo } = await searchParams;
  const returnTo = safeReturnTo(requestedReturnTo, "/profile");
  const message = messages[status];
  const verified = Boolean(user?.emailVerifiedAt) || status === "verified";

  return (
    <main className="auth-page">
      <section className="card auth-card auth-card-new">
        <Link className="brand auth-logo" href="/">
          <span className="brand-word">Reel<span>Pay</span></span>
        </Link>
        <span className="eyebrow"><MailCheck size={15} /> Безопасность аккаунта</span>
        <h1>{verified ? "Email подтверждён" : "Подтвердите email"}</h1>
        <p className="muted">
          {verified
            ? "Адрес проверен. Можно продолжить работу."
            : `Мы отправим одноразовую ссылку на ${user?.email || "ваш адрес"}.`}
        </p>

        {message ? (
          <div className={message.good ? "auth-ref" : "auth-error"} role="status">
            {message.good ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />}
            <span><strong>{message.title}</strong><br />{message.text}</span>
          </div>
        ) : null}

        {verified ? (
          <Link className="btn btn-primary" href={returnTo}>Продолжить</Link>
        ) : user ? (
          <form action="/api/auth/verify-email" method="post">
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="btn btn-primary" type="submit"><MailCheck size={18} /> Отправить письмо</button>
          </form>
        ) : (
          <Link className="btn btn-primary" href="/login">Войти</Link>
        )}
      </section>
    </main>
  );
}
