import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { stringify } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import {
  encryptedTikTokTokenData,
  exchangeTikTokCode,
  fetchTikTokProfile,
  isConnectableSocialPlatform,
  socialCallbackUri,
  socialPlatformConfigured
} from "@/lib/social-platforms";

function sameState(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const base = new URL(request.url).origin;
  const platformValue = (await params).platform.toUpperCase();
  const fail = async (reason: string, userId?: string) => {
    await trackEvent({
      request,
      userId,
      type: "SOCIAL_CONNECT_FAILED",
      path: "/settings/account",
      provider: platformValue.toLowerCase(),
      metadata: { reason }
    });
    return NextResponse.redirect(new URL(`/settings/account?social=${encodeURIComponent(reason)}`, base), 303);
  };

  if (
    !isConnectableSocialPlatform(platformValue)
    || platformValue !== "TIKTOK"
    || !socialPlatformConfigured(platformValue)
  ) {
    return fail("unavailable");
  }

  const jar = await cookies();
  const expectedState = jar.get("social_oauth_state")?.value;
  const expectedPlatform = jar.get("social_oauth_platform")?.value;
  const expectedUserId = jar.get("social_oauth_user")?.value;
  jar.delete("social_oauth_state");
  jar.delete("social_oauth_platform");
  jar.delete("social_oauth_user");

  const currentUser = await getCurrentUser();
  if (!currentUser || !expectedUserId || currentUser.id !== expectedUserId) return fail("session");
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return fail("denied", currentUser.id);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (
    !state
    || !code
    || !expectedState
    || expectedPlatform !== platformValue
    || !sameState(expectedState, state)
  ) {
    return fail("state", currentUser.id);
  }

  try {
    const tokens = await exchangeTikTokCode(code, socialCallbackUri(request.url, "TIKTOK"));
    const profile = await fetchTikTokProfile(tokens.access_token!);
    const externalId = tokens.open_id!;
    const conflict = await prisma.socialAccount.findUnique({
      where: { platform_externalId: { platform: "TIKTOK", externalId } },
      select: { userId: true }
    });
    if (conflict && conflict.userId !== currentUser.id) return fail("already_connected", currentUser.id);

    const handle = String(profile?.username || profile?.display_name || `tiktok-${externalId.slice(0, 8)}`).slice(0, 80);
    const tokenData = encryptedTikTokTokenData(tokens);
    await prisma.$transaction(async (db) => {
      await db.socialAccount.deleteMany({ where: { userId: currentUser.id, platform: "TIKTOK" } });
      const account = await db.socialAccount.create({
        data: {
          userId: currentUser.id,
          platform: "TIKTOK",
          externalId,
          handle,
          ...tokenData
        }
      });
      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "SOCIAL_ACCOUNT_CONNECTED",
          entity: "SocialAccount",
          entityId: account.id,
          metadata: stringify({ platform: "TIKTOK", scopes: JSON.parse(tokenData.scopesJson) })
        }
      });
    });
    await trackEvent({
      request,
      userId: currentUser.id,
      type: "SOCIAL_CONNECT_COMPLETED",
      path: "/settings/account",
      provider: "tiktok"
    });
    return NextResponse.redirect(new URL("/settings/account?social=connected", base), 303);
  } catch {
    return fail("failed", currentUser.id);
  }
}
