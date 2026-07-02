"use client";

import { useState } from "react";
import { BROWSER_DATA_COOKIES } from "@/lib/browser-data";

function expireCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
}

export function PrivacyControls() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function resetBrowserData() {
    setBusy(true);
    setError("");
    try {
      BROWSER_DATA_COOKIES.forEach(expireCookie);
      localStorage.clear();
      sessionStorage.clear();
      const response = await fetch("/api/privacy/reset-browser", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store"
      });
      if (!response.ok) throw new Error("reset_failed");
      window.location.replace("/login?reset=1");
    } catch {
      setError("Не удалось полностью удалить данные. Проверьте соединение и повторите.");
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
      {error ? <p className="privacy-error" role="alert">{error}</p> : null}
    </div>
  );
}
