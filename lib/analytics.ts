import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";

export const ANALYTICS_TYPES = new Set([
  "PAGE_VIEW",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "REGISTER_SUCCESS",
  "REGISTER_FAILED",
  "OAUTH_LOGIN",
  "OAUTH_REGISTER",
  "OAUTH_LINK",
  "OAUTH_FAILED",
  "SUBMISSION_POSTED",
  "SUBMISSION_FLAGGED",
  "LOGOUT",
  "CTA_CLICK",
  "STORE_OFFER_CLICK"
]);

function hashValue(value: string) {
  if (!value || value === "unknown") return null;
  const salt = process.env.ANALYTICS_SALT || process.env.SESSION_SECRET || "analytics-dev-salt";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

// Bound how much arbitrary client-supplied metadata can land in a single row, so a public
// caller can't inflate the analytics table with multi-megabyte payloads.
const MAX_METADATA_CHARS = 2000;
function clampMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return "{}";
  let serialized: string;
  try {
    serialized = JSON.stringify(metadata);
  } catch {
    return "{}";
  }
  return serialized.length > MAX_METADATA_CHARS
    ? JSON.stringify({ truncated: true, bytes: serialized.length })
    : serialized;
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
        metadata: clampMetadata(metadata)
      }
    });
  } catch {
    // Analytics must never break login, registration, or page rendering.
  }
}
