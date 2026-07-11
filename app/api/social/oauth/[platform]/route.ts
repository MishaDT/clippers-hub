import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  buildSocialAuthorizeUrl,
  isConnectableSocialPlatform,
  socialPlatformConfigured
} from "@/lib/social-platforms";
import { createSocialOAuthChallenge, pkceChallenge, SOCIAL_OAUTH_BINDER_COOKIE } from "@/lib/social-oauth-challenge";

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const user = await getCurrentUser();
  const base = new URL(request.url).origin;
  if (!user) return NextResponse.redirect(new URL("/login?returnTo=%2Fsettings%2Faccount", base), 303);

  const platformValue = (await params).platform.toUpperCase();
  if (!isConnectableSocialPlatform(platformValue) || platformValue === "INSTAGRAM") {
    return NextResponse.redirect(new URL("/settings/account?social=unavailable", base), 303);
  }
  if (!socialPlatformConfigured(platformValue)) {
    return NextResponse.redirect(new URL("/settings/account?social=unconfigured", base), 303);
  }
  if (!(await rateLimit(`social-oauth:${user.id}:${clientIp(request)}`, 8, 60_000))) {
    return NextResponse.redirect(new URL("/settings/account?social=too_many", base), 303);
  }

  const challenge = await createSocialOAuthChallenge(user.id, platformValue);
  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  };
  jar.set(SOCIAL_OAUTH_BINDER_COOKIE, challenge.binder, options);

  await trackEvent({
    request,
    userId: user.id,
    type: "SOCIAL_CONNECT_STARTED",
    path: "/settings/account",
    provider: platformValue.toLowerCase()
  });
  return NextResponse.redirect(buildSocialAuthorizeUrl(platformValue, {
    requestUrl: request.url,
    state: challenge.state,
    pkceChallenge: platformValue === "YOUTUBE" ? pkceChallenge(challenge.pkceVerifier) : undefined
  }));
}
