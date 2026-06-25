import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyControls } from "@/components/privacy-controls";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie и данные",
  description: "Какие cookie и данные использует ReelPay, зачем они нужны и как их сбросить."
};

export default function CookiesPage() {
  return (
    <>
      <header className="legal-head">
        <span className="legal-eyebrow">Cookie и данные</span>
        <h1>Что мы сохраняем в браузере</h1>
        <p className="legal-updated">Обновлено: {LEGAL.updated}</p>
        <p className="legal-lead">
          Коротко: мы используем только то, что нужно для входа, безопасности и работы сайта. Рекламных
          трекеров сейчас нет.
        </p>
      </header>

      <PrivacyControls />

      <section>
        <h2>Cookie и локальные данные</h2>
        <div className="legal-table">
          <div className="legal-row legal-row-head">
            <span>Что</span>
            <span>Зачем</span>
            <span>Срок</span>
          </div>
          <div className="legal-row">
            <span><code>clippers_session</code></span>
            <span>Помнит, что вы вошли в аккаунт. Cookie httpOnly: JavaScript на странице её не читает.</span>
            <span>До 30 дней или до выхода</span>
          </div>
          <div className="legal-row">
            <span><code>rp_consent</code></span>
            <span>Запоминает ваш выбор в баннере cookie.</span>
            <span>До 180 дней</span>
          </div>
          <div className="legal-row">
            <span><code>oauth_state</code>, <code>oauth_verifier</code>, <code>oauth_provider</code></span>
            <span>Защищают вход через Google, VK ID или Yandex от подмены запроса.</span>
            <span>Около 10 минут</span>
          </div>
          <div className="legal-row">
            <span><code>localStorage</code>, <code>sessionStorage</code></span>
            <span>Может использоваться интерфейсом для локальных настроек на этом устройстве.</span>
            <span>Пока вы не очистите браузер</span>
          </div>
        </div>
      </section>

      <section>
        <h2>Данные аккаунта</h2>
        <p>
          В базе сервиса хранятся данные, без которых платформа не работает: email, имя, роль, профиль,
          заказы, отклики, ссылки на опубликованные ролики, баланс, история операций и технические записи
          безопасности.
        </p>
        <p>
          Для соц-входа мы храним только связку <code>провайдер + id аккаунта</code>. Access token и refresh
          token не сохраняем и не публикуем ничего от вашего имени.
        </p>
      </section>

      <section>
        <h2>Что можно отключить</h2>
        <ul>
          <li>Рекламных и маркетинговых cookie сейчас нет.</li>
          <li>Необходимые cookie отключить нельзя без потери входа в аккаунт.</li>
          <li>Вы можете сбросить cookie на этом устройстве кнопкой выше.</li>
          <li>Удалить аккаунт можно в профиле. Это удалит данные аккаунта из базы сервиса.</li>
        </ul>
      </section>

      <section>
        <h2>Контакты</h2>
        <p>
          Вопросы по данным: <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>. Также см.{" "}
          <Link href="/legal/privacy">Политику конфиденциальности</Link>.
        </p>
      </section>
    </>
  );
}
