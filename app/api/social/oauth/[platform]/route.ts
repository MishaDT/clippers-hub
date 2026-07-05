import { randomBytes } from "node:crypto";
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

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const user = await getCurrentUser();
  const base = new URL(request.url).origin;
  if (!user) return NextResponse.redirect(new URL("/login?returnTo=%2Fsettings%2Faccount", base), 303);

  const platformValue = (await params).platform.toUpperCase();
  if (!isConnectableSocialPlatform(platformValue) || platformValue !== "TIKTOK") {
    return NextResponse.redirect(new URL("/settings/account?social=unavailable", base), 303);
  }
  if (!socialPlatformConfigured(platformValue)) {
    return NextResponse.redirect(new URL("/settings/account?social=unconfigured", base), 303);
  }
  if (!(await rateLimit(`social-oauth:${user.id}:${clientIp(request)}`, 8, 60_000))) {
    return NextResponse.redirect(new URL("/settings/account?social=too_many", base), 303);
  }

  const state = randomBytes(32).toString("base64url");
  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  };
  jar.set("social_oauth_state", state, options);
  jar.set("social_oauth_platform", platformValue, options);
  jar.set("social_oauth_user", user.id, options);

  await trackEvent({
    request,
    userId: user.id,
    type: "SOCIAL_CONNECT_STARTED",
    path: "/settings/account",
    provider: platformValue.toLowerCase()
  });
  return NextResponse.redirect(buildSocialAuthorizeUrl(platformValue, { requestUrl: request.url, state }));
}
