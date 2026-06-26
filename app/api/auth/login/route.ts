import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPasswordOrDummy } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, sameOrigin } from "@/lib/security";

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
  await trackEvent({ request, userId: user.id, type: "LOGIN_SUCCESS", path: "/login" });
  return NextResponse.redirect(redirectUrl("/campaigns", request), 303);
}
