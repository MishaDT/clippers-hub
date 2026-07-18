"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analyticsAllowed, CONSENT_COOKIE } from "@/lib/cookie-preferences";

function consentValue() {
  return document.cookie.split("; ").find((item) => item.startsWith(`${CONSENT_COOKIE}=`))?.split("=")[1];
}

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

    const send = () => fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => undefined);

    if (analyticsAllowed(consentValue())) void send();
    const onConsent = () => {
      if (analyticsAllowed(consentValue())) void send();
    };
    window.addEventListener("rp:consent", onConsent);
    return () => window.removeEventListener("rp:consent", onConsent);
  }, [pathname, searchParams]);

  return null;
}
