import Link from "next/link";
import { ArrowRight, CheckCircle2, Play, Sparkles, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const suffix = Math.floor(Math.random() * 9999);

  return (
    <main className="auth-page auth-motion-page">
      <section className="card auth-card auth-card-new">
        <span className="eyebrow">Новый аккаунт</span>
        <h1>Начать в ReelPay</h1>
        <p className="muted">Выбери роль: можно заказывать ролики, выполнять заказы или совмещать оба сценария.</p>
        <form className="form" action="/api/auth/register" method="post">
          <label className="field">Имя<input name="name" defaultValue="New Clipper" required /></label>
          <label className="field">Ник<input name="handle" defaultValue={`user_${suffix}`} required /></label>
          <label className="field">Email<input name="email" type="email" defaultValue={`user${suffix}@clippers.local`} required /></label>
          <label className="field">Пароль<input name="password" type="password" defaultValue="password123" required /></label>
          <label className="field">
            Роль
            <select name="role" defaultValue="WORKER">
              <option value="WORKER">Я хочу выполнять заказы</option>
              <option value="CLIENT">Я хочу заказывать клипы</option>
              <option value="BOTH">И то, и другое</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit"><UserPlus size={18} /> Создать аккаунт</button>
        </form>
        <div className="auth-hints">
          <span><CheckCircle2 size={16} /> Профиль создаётся сразу</span>
          <span><Sparkles size={16} /> Демо-данные уже внутри</span>
        </div>
        <p className="small">Уже есть аккаунт? <Link href="/login">Войти <ArrowRight size={14} /></Link></p>
      </section>

      <section className="auth-stage">
        <div className="auth-brand">
          <span className="brand-word">Reel<span>Pay</span></span>
          <p>После регистрации ты попадаешь в живую ленту заказов, можешь сохранять кампании, лайкать идеи и отправлять работы.</p>
        </div>
        <div className="auth-showcase" aria-hidden="true">
          <div className="motion-card card-a">
            <span><UserPlus size={18} /></span>
            <strong>3 шага</strong>
            <small>профиль, соцсеть, первый заказ</small>
          </div>
          <div className="motion-card card-b">
            <span><Sparkles size={18} /></span>
            <strong>+1 200 ₽</strong>
            <small>welcome-задача</small>
          </div>
          <div className="auth-phone">
            <div className="auth-video-strip">
              <i />
              <i />
              <i />
            </div>
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
