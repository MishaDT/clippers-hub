import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, sameOrigin, validatePassword } from "@/lib/security";

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
  if (!sameOrigin(request)) {
    return fail(request, "invalid");
  }
  if (!rateLimit(`register:${clientIp(request)}`, 5, 60_000)) {
    return fail(request, "too_many");
  }
  const formData = await request.formData();
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
  const refRaw = String(formData.get("ref") || "").trim().toUpperCase().slice(0, 12);
  let referredBy: string | undefined;
  if (refRaw) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: refRaw }, select: { referralCode: true } });
    if (referrer) referredBy = referrer.referralCode;
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: await hashPassword(input.password),
        name: input.name,
        handle,
        role: "BOTH",
        referralCode: handle.toUpperCase().slice(0, 12),
        referredBy
      }
    });
    await createSession(user.id);
    await trackEvent({ request, userId: user.id, type: "REGISTER_SUCCESS", path: "/register" });
    return NextResponse.redirect(redirectUrl("/campaigns", request), 303);
  } catch {
    // unique email/handle collision, etc.
    return fail(request, "register_failed");
  }
}
