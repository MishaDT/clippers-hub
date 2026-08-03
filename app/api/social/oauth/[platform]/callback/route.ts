import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { stringify } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import {
  encryptedTikTokTokenData,
  encryptedYouTubeTokenData,
  exchangeTikTokCode,
  exchangeYouTubeCode,
  fetchTikTokProfile,
  fetchYouTubeChannel,
  isConnectableSocialPlatform,
  socialCallbackUri,
  socialPlatformConfigured
} from "@/lib/social-platforms";
import { consumeSocialOAuthChallenge, SOCIAL_OAUTH_BINDER_COOKIE } from "@/lib/social-oauth-challenge";

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
    || platformValue === "INSTAGRAM"
    || !socialPlatformConfigured(platformValue)
  ) {
    return fail("unavailable");
  }

  const jar = await cookies();
  const binder = jar.get(SOCIAL_OAUTH_BINDER_COOKIE)?.value;
  jar.delete(SOCIAL_OAUTH_BINDER_COOKIE);

  const currentUser = await getCurrentUser();
  if (!currentUser || !binder) return fail("session");
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return fail("denied", currentUser.id);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (
    !state
    || !code
  ) {
    return fail("state", currentUser.id);
  }
  const challenge = await consumeSocialOAuthChallenge({
    userId: currentUser.id,
    platform: platformValue,
    state,
    binder
  });
  if (!challenge) return fail("state", currentUser.id);

  try {
    const redirectUri = socialCallbackUri(request.url, platformValue);
    const connected = platformValue === "TIKTOK"
      ? await (async () => {
          const tokens = await exchangeTikTokCode(code, redirectUri);
          const profile = await fetchTikTokProfile(tokens.access_token!);
          const externalId = tokens.open_id!;
          return {
            externalId,
            handle: String(profile?.username || profile?.display_name || `tiktok-${externalId.slice(0, 8)}`).slice(0, 80),
            accountUrl: profile?.username ? `https://www.tiktok.com/@${profile.username}` : null,
            tokenData: encryptedTikTokTokenData(tokens)
          };
        })()
      : await (async () => {
          const tokens = await exchangeYouTubeCode(code, redirectUri, challenge.pkceVerifier || "");
          const channel = await fetchYouTubeChannel(tokens.access_token!);
          return {
            externalId: channel.id,
            handle: String(channel.snippet?.customUrl || channel.snippet?.title || channel.id).slice(0, 80),
            accountUrl: `https://www.youtube.com/channel/${channel.id}`,
            tokenData: encryptedYouTubeTokenData(tokens)
          };
        })();
    const { externalId, handle, accountUrl, tokenData } = connected;
    const conflict = await prisma.socialAccount.findUnique({
      where: { platform_externalId: { platform: platformValue, externalId } },
      select: { userId: true }
    });
    if (conflict && conflict.userId !== currentUser.id) return fail("already_connected", currentUser.id);

    await prisma.$transaction(async (db) => {
      const account = await db.socialAccount.upsert({
        where: { platform_externalId: { platform: platformValue, externalId } },
        create: {
          userId: currentUser.id,
          platform: platformValue,
          externalId,
          handle,
          accountUrl,
          verifiedAt: new Date(),
          lastCheckedAt: new Date(),
          verificationMethod: "OAUTH_READONLY"
        },
        update: { handle, accountUrl, connectionStatus: "CONNECTED", reconnectReason: null, verifiedAt: new Date(), lastCheckedAt: new Date() }
      });
      await db.socialCredential.upsert({
        where: { socialAccountId: account.id },
        create: { socialAccountId: account.id, ...tokenData },
        update: tokenData
      });
      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "SOCIAL_ACCOUNT_CONNECTED",
          entity: "SocialAccount",
          entityId: account.id,
          metadata: stringify({ platform: platformValue, scopes: JSON.parse(tokenData.scopesJson) })
        }
      });
    });
    await trackEvent({
      request,
      userId: currentUser.id,
      type: "SOCIAL_CONNECT_COMPLETED",
      path: "/settings/account",
      provider: platformValue.toLowerCase()
    });
    return NextResponse.redirect(new URL(`/settings/account?social=connected&platform=${platformValue.toLowerCase()}`, base), 303);
  } catch {
    return fail("failed", currentUser.id);
  }
}
