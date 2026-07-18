import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPasswordOrDummy } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, strictSameOrigin } from "@/lib/security";
import { parseAuthIntent, safeAuthReturnTo } from "@/lib/auth-intent";
import { ROLE_MODE_COOKIE } from "@/lib/role-mode";
import { readFormDataWithLimit } from "@/lib/request-json";

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

async function fail(request: Request, code: string) {
  await trackEvent({ request, type: "LOGIN_FAILED", path: "/login", metadata: { reason: code } });
  return NextResponse.redirect(redirectUrl(`/login?error=${code}`, request), 303);
}

export async function POST(request: Request) {
  // Cross-origin and rate-limited probes redirect without writing an analytics row, so a
  // flood of blocked attempts can't be used to inflate the events table.
  if (!strictSameOrigin(request)) {
    return NextResponse.redirect(redirectUrl("/login?error=invalid", request), 303);
  }
  const loginLimit = process.env.E2E_TEST === "1" ? 100 : 8;
  if (!(await rateLimit(`login:${clientIp(request)}`, loginLimit, 60_000))) {
    return NextResponse.redirect(redirectUrl("/login?error=too_many", request), 303);
  }
  const formData = await readFormDataWithLimit(request, 16_000).catch(() => null);
  if (!formData) return fail(request, "invalid");
  const intent = parseAuthIntent(formData.get("intent"));
  const requestedReturnTo = formData.get("returnTo");
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  // The IP limit stops a single source; this privacy-safe account key also stops a
  // distributed password spray against one email without storing the email in Redis.
  const accountKey = createHash("sha256").update(email || "missing").digest("hex").slice(0, 32);
  const accountLimit = process.env.E2E_TEST === "1" ? 100 : 15;
  if (!(await rateLimit(`login-account:${accountKey}`, accountLimit, 15 * 60_000))) {
    return NextResponse.redirect(redirectUrl("/login?error=too_many", request), 303);
  }
  if (!email || !password) {
    await verifyPasswordOrDummy(password);
    return fail(request, "bad_credentials");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await verifyPasswordOrDummy(password, user?.passwordHash);
  if (!user || !passwordOk) {
    return fail(request, "bad_credentials");
  }
  // A moderated account must not be able to obtain a fresh session.
  if (user.accountStatus === "BANNED" || user.accountStatus === "FROZEN") {
    return fail(request, "account_restricted");
  }
  await createSession(user.id);
  const selectedMode = intent || (user.preferredRoleMode === "client" ? "client" : "worker");
  const returnTo = safeAuthReturnTo(requestedReturnTo, selectedMode);
  if (intent && user.preferredRoleMode !== intent) await prisma.user.update({ where: { id: user.id }, data: { preferredRoleMode: intent } });
  await trackEvent({ request, userId: user.id, type: "LOGIN_SUCCESS", path: "/login" });
  const response = NextResponse.redirect(redirectUrl(returnTo, request), 303);
  response.cookies.set(ROLE_MODE_COOKIE, selectedMode, { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000 });
  return response;
}
