import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";

export const ANALYTICS_TYPES = new Set([
  "PAGE_VIEW",
  "LOGIN_SUCCESS",
  "REGISTER_SUCCESS",
  "OAUTH_LOGIN",
  "OAUTH_REGISTER",
  "OAUTH_LINK",
  "LOGOUT",
  "CTA_CLICK"
]);

function hashValue(value: string) {
  if (!value || value === "unknown") return null;
  const salt = process.env.ANALYTICS_SALT || process.env.SESSION_SECRET || "analytics-dev-salt";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export async function trackEvent({
  request,
  userId,
  type,
  path,
  provider,
  metadata
}: {
  request?: Request;
  userId?: string | null;
  type: string;
  path?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!ANALYTICS_TYPES.has(type)) return;

  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: userId || null,
        type,
        path: path ? path.slice(0, 240) : null,
        provider: provider ? provider.slice(0, 40) : null,
        ipHash: request ? hashValue(clientIp(request)) : null,
        userAgentHash: request ? hashValue(request.headers.get("user-agent") || "") : null,
        metadata: JSON.stringify(metadata || {})
      }
    });
  } catch {
    // Analytics must never break login, registration, or page rendering.
  }
}
