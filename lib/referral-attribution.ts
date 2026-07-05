import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REFERRAL_COOKIE = "rp_referral";

function secret() {
  return process.env.SESSION_SECRET || "referral-dev-secret";
}

export function referralFingerprint(value: string) {
  if (!value || value === "unknown") return null;
  const salt = process.env.ANALYTICS_SALT || secret();
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export function createReferralCookie(code: string, days: number) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12);
  const expires = Date.now() + Math.max(1, Math.min(90, days)) * 86_400_000;
  const payload = `${normalized}.${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyReferralCookie(value: string | undefined | null) {
  if (!value) return null;
  const [code, expiresRaw, signature] = value.split(".");
  if (!code || !expiresRaw || !signature || !/^[A-Z0-9_]{3,12}$/.test(code)) return null;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;
  const expected = createHmac("sha256", secret()).update(`${code}.${expiresRaw}`).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return code;
}

export function referralCookieFromHeader(cookieHeader: string | null) {
  const value = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFERRAL_COOKIE}=`))
    ?.slice(REFERRAL_COOKIE.length + 1);
  return verifyReferralCookie(value ? decodeURIComponent(value) : null);
}
