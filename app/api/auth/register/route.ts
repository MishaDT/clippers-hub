import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, sameOrigin, validatePassword } from "@/lib/security";
import { parseAuthIntent, safeAuthReturnTo } from "@/lib/auth-intent";
import { ROLE_MODE_COOKIE } from "@/lib/role-mode";
import { sendEmailVerification } from "@/lib/email-verification";
import { referralCookieFromHeader, referralFingerprint } from "@/lib/referral-attribution";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(80)
});

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

async function fail(request: Request, code: string) {
  await trackEvent({ request, type: "REGISTER_FAILED", path: "/register", metadata: { reason: code } });
  return NextResponse.redirect(redirectUrl(`/register?error=${code}`, request), 303);
}

export async function POST(request: Request) {
  // Cross-origin and rate-limited probes redirect without writing an analytics row, so a
  // flood of blocked attempts can't be used to inflate the events table.
  if (!sameOrigin(request)) {
    return NextResponse.redirect(redirectUrl("/register?error=invalid", request), 303);
  }
  if (!(await rateLimit(`register:${clientIp(request)}`, 5, 60_000))) {
    return NextResponse.redirect(redirectUrl("/register?error=too_many", request), 303);
  }
  const formData = await request.formData();
  const intent = parseAuthIntent(formData.get("intent"));
  const returnTo = safeAuthReturnTo(formData.get("returnTo"), intent);
  const parsed = schema.safeParse({
    email: normalizeEmail(formData.get("email")),
    password: String(formData.get("password") || ""),
    name: String(formData.get("name") || "").trim()
  });
  if (!parsed.success) {
    return fail(request, "invalid");
  }
  const input = parsed.data;
  const passwordError = validatePassword(input.password, input.email);
  if (passwordError) {
    return fail(request, "weak_password");
  }
  const base = input.email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 12) || "user";
  const handle = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;

  // Referral: only accept a code that maps to a real referrer.
  const explicitRef = String(formData.get("ref") || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12);
  const refRaw = explicitRef || referralCookieFromHeader(request.headers.get("cookie")) || "";
  let referredBy: string | undefined;
  let referrerId: string | undefined;
  if (refRaw) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: refRaw }, select: { id: true, referralCode: true } });
    if (referrer) {
      referredBy = referrer.referralCode;
      referrerId = referrer.id;
    }
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash: await hashPassword(input.password),
          name: input.name,
          handle,
          role: "BOTH",
          referralCode: handle.toUpperCase().slice(0, 12),
          referredBy,
          preferredRoleMode: intent
        }
      });
      if (referrerId && referrerId !== created.id) {
        const ipHash = referralFingerprint(clientIp(request));
        const recentRegistrations = ipHash ? await tx.analyticsEvent.count({
          where: { type: "REGISTER_SUCCESS", ipHash, createdAt: { gte: new Date(Date.now() - 86_400_000) } }
        }) : 0;
        await tx.referralRelation.create({
          data: {
            referrerId,
            referredUserId: created.id,
            codeSnapshot: referredBy!,
            status: recentRegistrations >= 3 ? "FLAGGED" : "REGISTERED",
            flaggedAt: recentRegistrations >= 3 ? new Date() : null,
            flagReason: recentRegistrations >= 3 ? "Много регистраций с одного сетевого отпечатка" : null
          }
        });
      }
      // Referral reward is deferred to a qualifying action (first real clip), not paid at
      // signup — see submitClipAction. This blocks fake-signup farming of referral RP.
      return created;
    });
    await createSession(user.id);
    const verification = await sendEmailVerification({
      userId: user.id,
      email: user.email,
      name: user.name,
      returnTo
    });
    await trackEvent({ request, userId: user.id, type: "REGISTER_SUCCESS", path: "/register" });
    const verifyStatus = verification.sent ? "sent" : "unavailable";
    const response = NextResponse.redirect(redirectUrl(`/verify-email?status=${verifyStatus}`, request), 303);
    response.cookies.delete("rp_referral");
    if (intent) response.cookies.set(ROLE_MODE_COOKIE, intent, { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000 });
    return response;
  } catch {
    // unique email/handle collision, etc.
    return fail(request, "register_failed");
  }
}
