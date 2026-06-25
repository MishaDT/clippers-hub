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

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.redirect(redirectUrl("/login?error=invalid", request), 303);
  }
  if (!rateLimit(`login:${clientIp(request)}`, 8, 60_000)) {
    return NextResponse.redirect(redirectUrl("/login?error=too_many", request), 303);
  }
  const formData = await request.formData();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    await verifyPasswordOrDummy(password);
    return NextResponse.redirect(redirectUrl("/login?error=bad_credentials", request), 303);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await verifyPasswordOrDummy(password, user?.passwordHash);
  if (!user || !passwordOk) {
    return NextResponse.redirect(redirectUrl("/login?error=bad_credentials", request), 303);
  }
  await createSession(user.id);
  await trackEvent({ request, userId: user.id, type: "LOGIN_SUCCESS", path: "/login" });
  return NextResponse.redirect(redirectUrl("/feed", request), 303);
}
