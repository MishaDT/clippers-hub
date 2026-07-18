"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CONSENT_ANALYTICS, CONSENT_COOKIE, CONSENT_NECESSARY } from "@/lib/cookie-preferences";

const DATA_ITEMS = [
  {
    title: "Обязательные",
    text: "Вход, безопасность, выбранная роль, OAuth и реферальная ссылка. Без них часть сервиса не работает."
  },
  {
    title: "Необязательная аналитика",
    text: "Просмотры страниц и действия в интерфейсе. Рекламных cookie нет, исходный IP для аналитики не сохраняется."
  }
];

function hasConsent() {
  if (typeof document === "undefined") return true;
  return document.cookie.split("; ").some((c) => c.startsWith(`${CONSENT_COOKIE}=`));
}

export function CookieConsent() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    if (pathname === "/legal/cookies" || pathname === "/login" || pathname === "/register") {
      setShow(false);
      return;
    }
    if (!hasConsent()) setShow(true);
  }, [pathname]);

  if (!show) return null;

  function choose(value: typeof CONSENT_ANALYTICS | typeof CONSENT_NECESSARY) {
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax${secure}`;
    setShow(false);
    window.dispatchEvent(new Event("rp:consent"));
  }

  return (
    <div className="cookie-banner" role="dialog" aria-modal="false" aria-label="Настройки cookie">
      <div className="cookie-text">
        <b>Cookie — только по делу</b>
        <p>
          Обязательные cookie обеспечивают вход и безопасность. Аналитику можно разрешить отдельно; рекламных cookie нет.{" "}
          <Link href="/legal/cookies">Подробнее</Link>.
        </p>
        {details ? (
          <div className="cookie-details">
            {DATA_ITEMS.map((item) => (
              <div key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="cookie-actions">
        <button className="btn btn-ghost btn-small" type="button" onClick={() => setDetails((value) => !value)}>
          {details ? "Скрыть" : "Настроить"}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={() => choose(CONSENT_NECESSARY)}>
          Без аналитики
        </button>
        <button className="btn btn-primary btn-small" type="button" onClick={() => choose(CONSENT_ANALYTICS)}>
          Разрешить аналитику
        </button>
      </div>
    </div>
  );
}
