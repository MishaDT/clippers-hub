"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE = "rp_consent";

function hasConsent() {
  if (typeof document === "undefined") return true;
  return document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`));
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  // Only render after mount (avoids hydration mismatch) and only if no choice yet.
  useEffect(() => {
    if (!hasConsent()) setShow(true);
  }, []);

  if (!show) return null;

  function choose(value: "all" | "necessary") {
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    setShow(false);
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Согласие на использование cookie">
      <div className="cookie-text">
        <b>Мы бережём ваши данные</b>
        <p>
          Используем только необходимые cookie для входа и работы сайта. Рекламных трекеров нет.{" "}
          <Link href="/legal/cookies">Подробнее</Link>.
        </p>
      </div>
      <div className="cookie-actions">
        <button className="btn btn-ghost btn-small" type="button" onClick={() => choose("necessary")}>
          Только необходимые
        </button>
        <button className="btn btn-primary btn-small" type="button" onClick={() => choose("all")}>
          Принять все
        </button>
      </div>
    </div>
  );
}
