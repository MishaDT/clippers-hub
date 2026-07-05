import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildAuthorizeUrl,
  callbackUri,
  isConfigured,
  isProvider,
  pkcePair,
  randomState,
  redirectBase
} from "@/lib/oauth";
import { trackEvent } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parseAuthIntent, safeAuthReturnTo } from "@/lib/auth-intent";
import { REFERRAL_COOKIE, verifyReferralCookie } from "@/lib/referral-attribution";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const base = redirectBase(request.url);
  const url = new URL(request.url);
  const intent = url.searchParams.get("mode") === "link" ? "link" : "login";
  const roleIntent = parseAuthIntent(url.searchParams.get("intent"));
  const returnTo = safeAuthReturnTo(url.searchParams.get("returnTo"), roleIntent);

  if (!isProvider(provider)) {
    await trackEvent({ request, type: "OAUTH_FAILED", path: "/login", metadata: { reason: "invalid_provider", provider } });
    return NextResponse.redirect(new URL("/login?error=oauth_failed", base));
  }
  if (!isConfigured(provider)) {
    await trackEvent({ request, type: "OAUTH_FAILED", path: "/login", provider, metadata: { reason: "provider_unconfigured" } });
    return NextResponse.redirect(new URL("/login?error=provider_unconfigured", base));
  }
  if (!(await rateLimit(`oauth:${clientIp(request)}`, 12, 60_000))) {
    await trackEvent({ request, type: "OAUTH_FAILED", path: "/login", provider, metadata: { reason: "too_many" } });
    return NextResponse.redirect(new URL("/login?error=too_many", base));
  }

  const state = randomState();
  const { verifier, challenge } = pkcePair();

  const jar = await cookies();
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  };
  jar.set("oauth_state", state, cookieOpts);
  jar.set("oauth_verifier", verifier, cookieOpts);
  jar.set("oauth_provider", provider, cookieOpts);
  jar.set("oauth_intent", intent, cookieOpts);
  if (roleIntent) jar.set("oauth_role_intent", roleIntent, cookieOpts);
  jar.set("oauth_return_to", returnTo, cookieOpts);
  const referralCode = url.searchParams.get("ref")?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12)
    || verifyReferralCookie(jar.get(REFERRAL_COOKIE)?.value);
  if (referralCode) jar.set("oauth_referral", referralCode, cookieOpts);

  const authorizeUrl = buildAuthorizeUrl(provider, {
    redirectUri: callbackUri(request.url, provider),
    state,
    challenge
  });
  return NextResponse.redirect(authorizeUrl);
}
