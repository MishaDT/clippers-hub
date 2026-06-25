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

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const base = redirectBase(request.url);
  const url = new URL(request.url);
  const intent = url.searchParams.get("mode") === "link" ? "link" : "login";

  if (!isProvider(provider)) {
    await trackEvent({ request, type: "OAUTH_FAILED", path: "/login", metadata: { reason: "invalid_provider", provider } });
    return NextResponse.redirect(new URL("/login?error=oauth_failed", base));
  }
  if (!isConfigured(provider)) {
    await trackEvent({ request, type: "OAUTH_FAILED", path: "/login", provider, metadata: { reason: "provider_unconfigured" } });
    return NextResponse.redirect(new URL("/login?error=provider_unconfigured", base));
  }
  if (!rateLimit(`oauth:${clientIp(request)}`, 12, 60_000)) {
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

  const authorizeUrl = buildAuthorizeUrl(provider, {
    redirectUri: callbackUri(request.url, provider),
    state,
    challenge
  });
  return NextResponse.redirect(authorizeUrl);
}
