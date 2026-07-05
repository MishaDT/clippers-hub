import "server-only";

import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, socialTokenEncryptionReady } from "@/lib/secret-box";
import type { ViewSnapshot } from "@/lib/view-providers";

export type ConnectableSocialPlatform = "TIKTOK" | "INSTAGRAM";

type TikTokTokenResponse = {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type TikTokVideo = {
  id?: string;
  title?: string;
  video_description?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_url?: string;
};

export function isConnectableSocialPlatform(value: string): value is ConnectableSocialPlatform {
  return value === "TIKTOK" || value === "INSTAGRAM";
}

export function socialPlatformConfigured(platform: ConnectableSocialPlatform) {
  if (!socialTokenEncryptionReady()) return false;
  if (platform === "TIKTOK") {
    return Boolean(process.env.TIKTOK_CLIENT_KEY?.trim() && process.env.TIKTOK_CLIENT_SECRET?.trim());
  }
  return Boolean(process.env.INSTAGRAM_CLIENT_ID?.trim() && process.env.INSTAGRAM_CLIENT_SECRET?.trim());
}

function siteOrigin(requestUrl: string) {
  const configured = process.env.OAUTH_REDIRECT_BASE || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;
  return new URL(requestUrl).origin;
}

export function socialCallbackUri(requestUrl: string, platform: ConnectableSocialPlatform) {
  return `${siteOrigin(requestUrl)}/api/social/oauth/${platform.toLowerCase()}/callback`;
}

export function buildSocialAuthorizeUrl(
  platform: ConnectableSocialPlatform,
  options: { requestUrl: string; state: string }
) {
  const redirectUri = socialCallbackUri(options.requestUrl, platform);
  if (platform === "TIKTOK") {
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user.info.basic,video.list");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", options.state);
    return url;
  }
  throw new Error("Instagram OAuth will be enabled after Meta app review");
}

async function requestTikTokToken(body: URLSearchParams) {
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache"
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json() as TikTokTokenResponse;
  if (!response.ok || data.error || !data.access_token || !data.open_id) {
    throw new Error(data.error_description || data.error || `TikTok token exchange failed: ${response.status}`);
  }
  return data;
}

export async function exchangeTikTokCode(code: string, redirectUri: string) {
  return requestTikTokToken(new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    client_secret: process.env.TIKTOK_CLIENT_SECRET!,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  }));
}

async function refreshTikTokToken(refreshToken: string) {
  return requestTikTokToken(new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    client_secret: process.env.TIKTOK_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  }));
}

export async function fetchTikTokProfile(accessToken: string) {
  const response = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    }
  );
  const data = await response.json() as {
    data?: { user?: { open_id?: string; display_name?: string; username?: string } };
    error?: { code?: string; message?: string };
  };
  if (!response.ok || (data.error?.code && data.error.code !== "ok")) {
    throw new Error(data.error?.message || `TikTok profile request failed: ${response.status}`);
  }
  return data.data?.user;
}

export function encryptedTikTokTokenData(tokens: TikTokTokenResponse) {
  if (!tokens.access_token || !tokens.refresh_token) throw new Error("TikTok returned incomplete tokens");
  const now = Date.now();
  const scopes = String(tokens.scope || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!scopes.includes("video.list")) throw new Error("TikTok video.list permission was not granted");
  return {
    accessToken: encryptSecret(tokens.access_token),
    refreshToken: encryptSecret(tokens.refresh_token),
    tokenExpiresAt: new Date(now + Math.max(0, Number(tokens.expires_in || 0)) * 1000),
    refreshTokenExpiresAt: new Date(now + Math.max(0, Number(tokens.refresh_expires_in || 0)) * 1000),
    scopesJson: JSON.stringify(scopes),
    verifiedAt: new Date()
  };
}

async function usableTikTokAccessToken(userId: string) {
  const account = await prisma.socialAccount.findFirst({
    where: { userId, platform: "TIKTOK" },
    orderBy: { updatedAt: "desc" }
  });
  if (!account?.accessToken) throw new Error("TikTok account is not connected");

  if (!account.tokenExpiresAt || account.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000) {
    return decryptSecret(account.accessToken);
  }
  if (!account.refreshToken || (account.refreshTokenExpiresAt && account.refreshTokenExpiresAt.getTime() <= Date.now())) {
    throw new Error("TikTok authorization expired; reconnect the account");
  }

  const refreshed = await refreshTikTokToken(decryptSecret(account.refreshToken));
  const tokenData = encryptedTikTokTokenData(refreshed);
  await prisma.socialAccount.update({ where: { id: account.id }, data: tokenData });
  return refreshed.access_token!;
}

export async function fetchTikTokSnapshotForUser(userId: string, postUrl: string): Promise<ViewSnapshot> {
  const postId = postUrl.match(/\/video\/(\d+)/)?.[1];
  if (!postId) throw new Error("Cannot parse TikTok video id");
  const accessToken = await usableTikTokAccessToken(userId);
  const response = await fetch(
    "https://open.tiktokapis.com/v2/video/query/?fields=id,title,video_description,share_url,view_count,like_count,comment_count",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ filters: { video_ids: [postId] } }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    }
  );
  const data = await response.json() as {
    data?: { videos?: TikTokVideo[] };
    error?: { code?: string; message?: string };
  };
  const video = data.data?.videos?.find((item) => item.id === postId);
  if (!response.ok || (data.error?.code && data.error.code !== "ok") || !video) {
    throw new Error(data.error?.message || "TikTok video is unavailable or does not belong to the connected account");
  }
  return {
    platform: "TIKTOK",
    postId,
    views: Number(video.view_count || 0),
    likes: Number(video.like_count || 0),
    comments: Number(video.comment_count || 0),
    fetchedAt: new Date(),
    raw: video
  };
}

export async function revokeTikTokConnection(accessTokenEncrypted: string | null) {
  if (!accessTokenEncrypted || !socialPlatformConfigured("TIKTOK")) return;
  try {
    await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        token: decryptSecret(accessTokenEncrypted)
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    // Local deletion must still complete if TikTok is temporarily unavailable.
  }
}
