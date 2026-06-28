import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPasswordOrDummy } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, sameOrigin } from "@/lib/security";
import { parseAuthIntent, safeAuthReturnTo } from "@/lib/auth-intent";
import { ROLE_MODE_COOKIE } from "@/lib/role-mode";

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
  if (!sameOrigin(request)) {
    return fail(request, "invalid");
  }
  if (!rateLimit(`login:${clientIp(request)}`, 8, 60_000)) {
    return fail(request, "too_many");
  }
  const formData = await request.formData();
  const intent = parseAuthIntent(formData.get("intent"));
  const requestedReturnTo = formData.get("returnTo");
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    await verifyPasswordOrDummy(password);
    return fail(request, "bad_credentials");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await verifyPasswordOrDummy(password, user?.passwordHash);
  if (!user || !passwordOk) {
    return fail(request, "bad_credentials");
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
