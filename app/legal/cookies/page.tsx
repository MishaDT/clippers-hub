import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyControls } from "@/components/privacy-controls";
import { LEGAL } from "@/lib/legal";
import { CookiePreferenceControls } from "@/components/cookie-preference-controls";

export const metadata: Metadata = {
  title: "Cookie и данные",
  description: "Какие cookie и технические данные использует ReelPay."
};

export default function CookiesPage() {
  return (
    <>
      <header className="legal-head">
        <span className="legal-eyebrow">Cookie и данные</span>
        <h1>Что сайт сохраняет и зачем</h1>
        <p className="legal-updated">Обновлено: {LEGAL.updated}</p>
        <p className="legal-lead">
          Обязательные cookie нужны для входа, безопасности и выбранных функций. Необязательная продуктовая
          аналитика включается только после нажатия «Разрешить аналитику». Рекламных cookie сейчас нет.
        </p>
      </header>

      <CookiePreferenceControls />
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
            <span>Помнит, что вы вошли в аккаунт. Это httpOnly-cookie: JavaScript на странице ее не читает.</span>
            <span>До 30 дней или до выхода</span>
          </div>
          <div className="legal-row">
            <span><code>rp_consent</code></span>
            <span>Запоминает выбор в баннере cookie.</span>
            <span>До 180 дней</span>
          </div>
          <div className="legal-row">
            <span><code>rp_role_mode</code></span>
            <span>Запоминает выбранный режим: заказчик или исполнитель.</span>
            <span>До 1 года</span>
          </div>
          <div className="legal-row">
            <span><code>rp_referral</code></span>
            <span>Связывает регистрацию с партнёрской ссылкой. Значение подписано и не содержит имени или email.</span>
            <span>До 30 дней</span>
          </div>
          <div className="legal-row">
            <span><code>oauth_state</code>, <code>oauth_verifier</code>, <code>oauth_provider</code>, <code>oauth_intent</code>, <code>oauth_role_intent</code>, <code>oauth_return_to</code>, <code>oauth_referral</code></span>
            <span>Защищают вход через Google, VK ID или Yandex от подмены запроса.</span>
            <span>Около 10 минут</span>
          </div>
          <div className="legal-row">
            <span><code>localStorage</code>, <code>sessionStorage</code></span>
            <span>Могут использоваться интерфейсом для локальных настроек на этом устройстве.</span>
            <span>Пока вы не очистите браузер</span>
          </div>
        </div>
      </section>

      <section>
        <h2>Аналитика сайта</h2>
        <p>
          После отдельного разрешения сайт сохраняет просмотры страниц и действия в интерфейсе. Исходный IP в
          продуктовой аналитике не хранится: используется необратимый хеш. Отказ не ограничивает основные функции.
          События безопасности, необходимые для защиты аккаунтов, финансовых операций и ограничения атак, ведутся
          отдельно от необязательной продуктовой аналитики.
        </p>
      </section>

      <section>
        <h2>Данные аккаунта</h2>
        <p>
          В базе хранятся данные, без которых платформа не работает: email, имя, роль, профиль, заказы, отклики,
          ссылки на опубликованные ролики, баланс, история операций и технические записи безопасности.
        </p>
        <p>
          Для соц-входа мы храним только связку <code>провайдер + id аккаунта</code>. Access token и refresh token
          не сохраняем и не публикуем ничего от вашего имени.
        </p>
      </section>

      <section>
        <h2>Что можно отключить</h2>
        <ul>
          <li>«Без аналитики» — только обязательные cookie; основные функции продолжают работать.</li>
          <li>«Разрешить аналитику» — обязательные cookie плюс просмотры страниц и действия в интерфейсе.</li>
          <li>Рекламных и маркетинговых cookie сейчас нет.</li>
          <li>Необходимые cookie отключить нельзя без потери входа в аккаунт.</li>
          <li>Cookie на этом устройстве можно сбросить кнопкой выше.</li>
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
