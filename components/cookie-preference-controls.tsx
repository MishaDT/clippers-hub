"use client";

import { useEffect, useState } from "react";
import { analyticsAllowed, CONSENT_ANALYTICS, CONSENT_COOKIE, CONSENT_NECESSARY } from "@/lib/cookie-preferences";

function readPreference() {
  const value = document.cookie.split("; ").find((item) => item.startsWith(`${CONSENT_COOKIE}=`))?.split("=")[1];
  return analyticsAllowed(value) ? CONSENT_ANALYTICS : CONSENT_NECESSARY;
}

export function CookiePreferenceControls() {
  const [value, setValue] = useState<typeof CONSENT_ANALYTICS | typeof CONSENT_NECESSARY>(CONSENT_NECESSARY);
  useEffect(() => setValue(readPreference()), []);

  function save(next: typeof CONSENT_ANALYTICS | typeof CONSENT_NECESSARY) {
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax${secure}`;
    setValue(next);
    window.dispatchEvent(new Event("rp:consent"));
  }

  return <section className="privacy-controls" aria-labelledby="cookie-choice-title">
    <div><h2 id="cookie-choice-title">Ваш выбор</h2><p>Сейчас: <b>{value === CONSENT_ANALYTICS ? "обязательные + аналитика" : "только обязательные"}</b>. Изменить выбор можно в любое время.</p></div>
    <div className="cookie-actions">
      <button className="btn btn-ghost" type="button" aria-pressed={value === CONSENT_NECESSARY} onClick={() => save(CONSENT_NECESSARY)}>Без аналитики</button>
      <button className="btn btn-primary" type="button" aria-pressed={value === CONSENT_ANALYTICS} onClick={() => save(CONSENT_ANALYTICS)}>Разрешить аналитику</button>
    </div>
  </section>;
}
