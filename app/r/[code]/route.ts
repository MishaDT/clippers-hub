import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  createReferralCookie,
  REFERRAL_COOKIE,
  referralFingerprint
} from "@/lib/referral-attribution";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await context.params;
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12);
  const destination = new URL("/register", request.url);
  const referrer = code
    ? await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true, referralCode: true } })
    : null;
  if (!referrer) return NextResponse.redirect(destination, 303);

  const config = await prisma.referralProgramConfig.findUnique({ where: { id: "default" } });
  if (config && !config.enabled) return NextResponse.redirect(destination, 303);
  destination.searchParams.set("ref", referrer.referralCode);
  const ip = clientIp(request);
  if (await rateLimit(`ref-click:${referrer.id}:${ip}`, 4, 86_400_000)) {
    await prisma.referralClick.create({
      data: {
        referrerId: referrer.id,
        codeSnapshot: referrer.referralCode,
        ipHash: referralFingerprint(ip),
        userAgentHash: referralFingerprint(request.headers.get("user-agent") || ""),
        landingPath: "/register"
      }
    }).catch(() => null);
  }

  const days = Math.max(1, Math.min(90, config?.attributionDays ?? 30));
  const response = NextResponse.redirect(destination, 303);
  response.cookies.set(REFERRAL_COOKIE, createReferralCookie(referrer.referralCode, days), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 86_400
  });
  return response;
}
