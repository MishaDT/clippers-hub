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
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const base = redirectBase(request.url);

  if (!isProvider(provider)) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", base));
  }
  if (!isConfigured(provider)) {
    return NextResponse.redirect(new URL("/login?error=provider_unconfigured", base));
  }
  if (!rateLimit(`oauth:${clientIp(request)}`, 12, 60_000)) {
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

  const authorizeUrl = buildAuthorizeUrl(provider, {
    redirectUri: callbackUri(request.url, provider),
    state,
    challenge
  });
  return NextResponse.redirect(authorizeUrl);
}
