import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Политика использования cookie",
  description: "Какие cookie использует ReelPay. По умолчанию — только необходимые, без рекламных трекеров."
};

export default function CookiesPage() {
  return (
    <>
      <header className="legal-head">
        <span className="legal-eyebrow">Cookie</span>
        <h1>Политика использования cookie</h1>
        <p className="legal-updated">Обновлено: {LEGAL.updated}</p>
        <p className="legal-lead">
          Мы используем только необходимые cookie. По умолчанию — никакой рекламной слежки и сторонних
          трекеров.
        </p>
      </header>

      <section>
        <h2>1. Что такое cookie</h2>
        <p>
          Cookie — небольшие файлы, которые сайт сохраняет в браузере. Они нужны, чтобы сайт «помнил»
          вас между страницами — например, что вы вошли в аккаунт.
        </p>
      </section>

      <section>
        <h2>2. Какие cookie мы используем</h2>
        <div className="legal-table">
          <div className="legal-row legal-row-head">
            <span>Cookie</span>
            <span>Назначение</span>
            <span>Тип</span>
          </div>
          <div className="legal-row">
            <span><code>clippers_session</code></span>
            <span>Хранит вашу сессию входа (подписанная, httpOnly).</span>
            <span>Необходимая</span>
          </div>
          <div className="legal-row">
            <span><code>rp_consent</code></span>
            <span>Запоминает ваш выбор в баннере cookie, чтобы не спрашивать снова.</span>
            <span>Необходимая</span>
          </div>
          <div className="legal-row">
            <span><code>oauth_state</code>, <code>oauth_verifier</code></span>
            <span>Временная защита входа через соцсети (живут несколько минут).</span>
            <span>Необходимая</span>
          </div>
        </div>
      </section>

      <section>
        <h2>3. Аналитика и реклама</h2>
        <p>
          Сейчас мы <b>не используем</b> рекламные cookie и сторонние аналитические трекеры. Если в
          будущем мы добавим необязательную аналитику, она будет включаться только с вашего согласия в
          баннере cookie.
        </p>
      </section>

      <section>
        <h2>4. Как управлять</h2>
        <ul>
          <li>В баннере cookie можно выбрать «Только необходимые» или «Принять все».</li>
          <li>Cookie можно удалить или заблокировать в настройках браузера.</li>
          <li>
            Если отключить необходимые cookie, вход в аккаунт работать не будет — они технически
            обязательны.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Контакты</h2>
        <p>
          Вопросы: <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>. См. также{" "}
          <Link href="/legal/privacy">Политику конфиденциальности</Link>.
        </p>
      </section>
    </>
  );
}
