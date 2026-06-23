import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, UserPlus } from "lucide-react";

export default function RegisterPage() {
  return (
    <main className="auth-page auth-motion-page">
      <section className="card auth-card auth-card-new">
        <span className="eyebrow">Новый аккаунт</span>
        <h1>Начать в ReelPay</h1>
        <p className="muted">Регистрация за минуту. Роль — клиппер или заказчик — выберешь потом в профиле.</p>
        <form className="form" action="/api/auth/register" method="post">
          <label className="field">Имя<input name="name" placeholder="Как тебя зовут" required /></label>
          <label className="field">Email<input name="email" type="email" placeholder="you@example.com" required /></label>
          <label className="field">Пароль<input name="password" type="password" placeholder="Минимум 8 символов" minLength={8} required /></label>
          <button className="btn btn-primary" type="submit"><UserPlus size={18} /> Создать аккаунт</button>
        </form>
        <div className="auth-hints">
          <span><CheckCircle2 size={16} /> Бесплатно</span>
          <span><Sparkles size={16} /> Сразу в ленту заказов</span>
        </div>
        <p className="small">Уже есть аккаунт? <Link href="/login">Войти <ArrowRight size={14} /></Link></p>
      </section>

      <section className="auth-stage">
        <div className="auth-brand">
          <span className="brand-word">Reel<span>Pay</span></span>
          <p>После регистрации попадаешь в ленту заказов: берёшь задание, делаешь клип, отправляешь ссылку — и получаешь за просмотры.</p>
        </div>
        <div className="auth-showcase" aria-hidden="true">
          <div className="auth-phone">
            <div className="auth-video-strip"><i /><i /><i /></div>
            <div className="auth-task">
              <b>Первый заказ готов</b>
              <span>выбери ролик и отправь ссылку</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
