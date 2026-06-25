"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const COOKIE = "rp_consent";

const DATA_ITEMS = [
  {
    title: "Сессия входа",
    text: "clippers_session хранит факт входа. Cookie подписанная, httpOnly, нужна для аккаунта."
  },
  {
    title: "Выбор cookie",
    text: "rp_consent запоминает, что вы выбрали в этом окне, чтобы не спрашивать каждый раз."
  },
  {
    title: "Соц-вход",
    text: "oauth_state и oauth_verifier живут несколько минут и защищают вход через Google, VK ID или Yandex."
  },
  {
    title: "Рабочие данные",
    text: "В базе хранятся профиль, заказы, отклики, ссылки на ролики, баланс и история операций."
  }
];

function hasConsent() {
  if (typeof document === "undefined") return true;
  return document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`));
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

  function choose(value: "all" | "necessary") {
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    setShow(false);
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Согласие на cookie и данные">
      <div className="cookie-text">
        <b>Мы бережём ваши данные</b>
        <p>
          Используем только нужное для входа и работы сервиса. Рекламных трекеров нет.{" "}
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
          {details ? "Скрыть" : "Что собирается"}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={() => choose("necessary")}>
          Только нужное
        </button>
        <button className="btn btn-primary btn-small" type="button" onClick={() => choose("all")}>
          Принять
        </button>
      </div>
    </div>
  );
}
