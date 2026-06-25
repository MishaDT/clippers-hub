"use client";

import { useState } from "react";

const CLIENT_COOKIES = ["rp_consent", "oauth_state", "oauth_verifier", "oauth_provider", "oauth_intent"];

function expireCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
}

export function PrivacyControls() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resetBrowserData() {
    setBusy(true);
    try {
      CLIENT_COOKIES.forEach(expireCookie);
      localStorage.clear();
      sessionStorage.clear();
      await fetch("/api/privacy/reset-browser", { method: "POST" });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="privacy-controls">
      <div>
        <h2>Сбросить cookie и данные браузера</h2>
        <p>
          Удалит выбор cookie, временные данные OAuth-входа, localStorage/sessionStorage и завершит текущую
          сессию входа на этом устройстве.
        </p>
      </div>
      <button className="btn btn-primary" type="button" onClick={resetBrowserData} disabled={busy}>
        {busy ? "Сбрасываем..." : "Сбросить на этом устройстве"}
      </button>
      {done ? <p className="privacy-done">Готово. Обновите страницу, если хотите заново выбрать cookie.</p> : null}
    </div>
  );
}
