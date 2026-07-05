"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const payload = JSON.stringify({
      type: "PAGE_VIEW",
      path,
      metadata: {
        referrerHost: document.referrer
          ? (() => {
              try {
                return new URL(document.referrer).hostname;
              } catch {
                return null;
              }
            })()
          : null
      }
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
      return;
    }

    fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}
