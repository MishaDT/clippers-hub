"use client";

import { useEffect } from "react";

type VersionResponse = { version?: string };

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function DeploymentRefresh({ version }: { version: string }) {
  useEffect(() => {
    if (version === "local") return;

    let checking = false;
    let dirty = false;
    const controller = new AbortController();

    const markDirty = (event: Event) => {
      if (isEditable(event.target)) dirty = true;
    };

    const check = async () => {
      if (checking || dirty || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch("/api/version", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal
        });
        if (!response.ok) return;
        const data = await response.json() as VersionResponse;
        if (!data.version || data.version === version || data.version === "local") return;

        const reloadKey = `reelpay-version:${data.version}`;
        if (sessionStorage.getItem(reloadKey)) return;
        sessionStorage.setItem(reloadKey, "reloaded");
        window.location.reload();
      } catch {
        // A failed background check must never interrupt the user's work.
      } finally {
        checking = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void check();
    };

    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", check);
    const interval = window.setInterval(() => void check(), 5 * 60 * 1000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", check);
    };
  }, [version]);

  return null;
}
