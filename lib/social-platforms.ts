import "server-only";

import { prisma } from "@/lib/prisma";
import { activeSocialEncryptionKeyId, decryptSecret, encryptSecret, socialTokenEncryptionReady } from "@/lib/secret-box";
import type { ViewSnapshot } from "@/lib/view-providers";
import { viewProviders } from "@/lib/view-providers";
import type { OwnershipResult } from "@/lib/antifraud";

export type ConnectableSocialPlatform = "YOUTUBE" | "TIKTOK" | "INSTAGRAM";

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
  return value === "YOUTUBE" || value === "TIKTOK" || value === "INSTAGRAM";
}

export function socialPlatformConfigured(platform: ConnectableSocialPlatform) {
  if (!socialTokenEncryptionReady()) return false;
  if (platform === "TIKTOK") {
    return Boolean(process.env.TIKTOK_CLIENT_KEY?.trim() && process.env.TIKTOK_CLIENT_SECRET?.trim());
  }
  if (platform === "YOUTUBE") {
    return Boolean(
      (process.env.YOUTUBE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)?.trim()
      && (process.env.YOUTUBE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)?.trim()
    );
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
  options: { requestUrl: string; state: string; pkceChallenge?: string }
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
  if (platform === "YOUTUBE") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.YOUTUBE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.readonly");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", options.state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    if (options.pkceChallenge) {
      url.searchParams.set("code_challenge", options.pkceChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
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
    accessTokenEncrypted: encryptSecret(tokens.access_token, "social:TIKTOK"),
    refreshTokenEncrypted: encryptSecret(tokens.refresh_token, "social:TIKTOK"),
    encryptionKeyId: activeSocialEncryptionKeyId(),
    tokenExpiresAt: new Date(now + Math.max(0, Number(tokens.expires_in || 0)) * 1000),
    refreshTokenExpiresAt: new Date(now + Math.max(0, Number(tokens.refresh_expires_in || 0)) * 1000),
    scopesJson: JSON.stringify(scopes),
    lastRefreshAt: new Date()
  };
}

type YouTubeTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function requestYouTubeToken(body: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json() as YouTubeTokenResponse;
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "YouTube token exchange failed");
  return data;
}

async function refreshYouTubeToken(refreshToken: string) {
  return requestYouTubeToken(new URLSearchParams({
    client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  }));
}

export async function exchangeYouTubeCode(code: string, redirectUri: string, verifier: string) {
  return requestYouTubeToken(new URLSearchParams({
    client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  }));
}

export async function fetchYouTubeChannel(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json() as { items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string } }> };
  const channel = data.items?.[0];
  if (!response.ok || !channel?.id) throw new Error("YouTube channel is unavailable");
  return channel;
}

export function encryptedYouTubeTokenData(tokens: YouTubeTokenResponse) {
  if (!tokens.access_token) throw new Error("YouTube returned no access token");
  const scopes = String(tokens.scope || "").split(/\s+/).filter(Boolean);
  return {
    accessTokenEncrypted: encryptSecret(tokens.access_token, "social:YOUTUBE"),
    refreshTokenEncrypted: tokens.refresh_token ? encryptSecret(tokens.refresh_token, "social:YOUTUBE") : null,
    encryptionKeyId: activeSocialEncryptionKeyId(),
    tokenExpiresAt: new Date(Date.now() + Math.max(0, Number(tokens.expires_in || 0)) * 1000),
    scopesJson: JSON.stringify(scopes),
    lastRefreshAt: new Date()
  };
}

async function usableTikTokAccessToken(userId: string, socialAccountId?: string | null) {
  const account = await prisma.socialAccount.findFirst({
    where: { userId, platform: "TIKTOK", ...(socialAccountId ? { id: socialAccountId } : {}) },
    include: { credential: true },
    orderBy: { updatedAt: "desc" }
  });
  const credential = account?.credential;
  if (!account || !credential?.accessTokenEncrypted || account.connectionStatus !== "CONNECTED") throw new Error("TikTok account is not connected");

  if (!credential.tokenExpiresAt || credential.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000) {
    return decryptSecret(credential.accessTokenEncrypted, "social:TIKTOK");
  }
  if (!credential.refreshTokenEncrypted || (credential.refreshTokenExpiresAt && credential.refreshTokenExpiresAt.getTime() <= Date.now())) {
    await prisma.socialAccount.update({ where: { id: account.id }, data: { connectionStatus: "RECONNECT_REQUIRED", reconnectReason: "refresh_token_expired", lastCheckedAt: new Date() } });
    throw new Error("TikTok authorization expired; reconnect the account");
  }

  const refreshed = await refreshTikTokToken(decryptSecret(credential.refreshTokenEncrypted, "social:TIKTOK"));
  const tokenData = encryptedTikTokTokenData(refreshed);
  const updated = await prisma.socialCredential.updateMany({
    where: { id: credential.id, refreshVersion: credential.refreshVersion },
    data: { ...tokenData, refreshVersion: { increment: 1 } }
  });
  if (updated.count !== 1) throw new Error("Token refresh is already in progress");
  return refreshed.access_token!;
}

export async function fetchTikTokSnapshotForUser(userId: string, postUrl: string, socialAccountId?: string | null): Promise<ViewSnapshot> {
  const postId = postUrl.match(/\/video\/(\d+)/)?.[1];
  if (!postId) throw new Error("Cannot parse TikTok video id");
  const accessToken = await usableTikTokAccessToken(userId, socialAccountId);
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

export async function verifySocialAccountConnection(userId: string, socialAccountId: string) {
  const account = await prisma.socialAccount.findFirst({
    where: { id: socialAccountId, userId },
    include: { credential: true }
  });
  if (!account?.credential) throw new Error("Connection not found");
  try {
    if (account.platform === "TIKTOK") {
      const token = await usableTikTokAccessToken(userId, account.id);
      const profile = await fetchTikTokProfile(token);
      if (profile?.open_id && profile.open_id !== account.externalId) throw new Error("Account mismatch");
    } else if (account.platform === "YOUTUBE") {
      let accessToken = decryptSecret(account.credential.accessTokenEncrypted, "social:YOUTUBE");
      if (account.credential.tokenExpiresAt && account.credential.tokenExpiresAt.getTime() <= Date.now() + 5 * 60_000) {
        if (!account.credential.refreshTokenEncrypted) throw new Error("YouTube authorization expired");
        const refreshed = await refreshYouTubeToken(decryptSecret(account.credential.refreshTokenEncrypted, "social:YOUTUBE"));
        const tokenData = encryptedYouTubeTokenData({ ...refreshed, refresh_token: undefined });
        await prisma.socialCredential.update({
          where: { id: account.credential.id },
          data: { ...tokenData, refreshTokenEncrypted: account.credential.refreshTokenEncrypted, refreshVersion: { increment: 1 } }
        });
        accessToken = refreshed.access_token!;
      }
      const channel = await fetchYouTubeChannel(accessToken);
      if (channel.id !== account.externalId) throw new Error("Account mismatch");
    } else {
      throw new Error("Platform OAuth is unavailable");
    }
    await prisma.socialAccount.update({ where: { id: account.id }, data: { connectionStatus: "CONNECTED", reconnectReason: null, lastCheckedAt: new Date(), verifiedAt: new Date() } });
    return true;
  } catch (error) {
    await prisma.socialAccount.update({ where: { id: account.id }, data: { connectionStatus: "RECONNECT_REQUIRED", reconnectReason: "authorization_failed", lastCheckedAt: new Date() } });
    throw error;
  }
}

export async function checkConnectedAccountOwnership(input: {
  userId: string;
  socialAccountId: string;
  platform: "YOUTUBE" | "TIKTOK";
  postUrl: string;
}): Promise<OwnershipResult> {
  const account = await prisma.socialAccount.findFirst({
    where: { id: input.socialAccountId, userId: input.userId, platform: input.platform, connectionStatus: "CONNECTED" },
    select: { id: true, externalId: true }
  });
  if (!account) return { platform: input.platform, verifiable: true, matched: false, reason: "connected_account_unavailable" };
  if (input.platform === "TIKTOK") {
    const snapshot = await fetchTikTokSnapshotForUser(input.userId, input.postUrl, account.id);
    return { platform: input.platform, verifiable: true, matched: true, reason: "connected_account_match", evidence: { postId: snapshot.postId, accountId: account.id } };
  }
  const meta = await viewProviders.YOUTUBE.fetchMeta!(input.postUrl);
  const matched = meta.channelId === account.externalId;
  return { platform: input.platform, verifiable: true, matched, reason: matched ? "connected_account_match" : "connected_account_mismatch", evidence: { postId: meta.postId, channelId: meta.channelId, channelTitle: meta.channelTitle } };
}

export async function revokeTikTokConnection(accessTokenEncrypted: string | null) {
  if (!accessTokenEncrypted || !socialPlatformConfigured("TIKTOK")) return false;
  try {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        token: decryptSecret(accessTokenEncrypted, "social:TIKTOK")
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function revokeSocialConnection(platform: string, accessTokenEncrypted: string | null) {
  if (platform === "TIKTOK") return revokeTikTokConnection(accessTokenEncrypted);
  if (platform === "YOUTUBE" && accessTokenEncrypted) {
    try {
      const response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: decryptSecret(accessTokenEncrypted, "social:YOUTUBE") }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000)
      });
      return response.ok;
    } catch { return false; }
  }
  return true;
}

export async function processPendingSocialRevocations() {
  const jobs = await prisma.socialRevocationJob.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: 20
  });
  let completed = 0;
  for (const job of jobs) {
    const ok = await revokeSocialConnection(job.platform, job.accessTokenEncrypted);
    await prisma.socialRevocationJob.update({
      where: { id: job.id },
      data: ok
        ? { status: "COMPLETED", completedAt: new Date(), attempts: { increment: 1 }, lastError: null }
        : { attempts: { increment: 1 }, lastError: "provider_unavailable", nextAttemptAt: new Date(Date.now() + Math.min(24, 2 ** Math.min(job.attempts, 5)) * 3600_000) }
    });
    if (ok) completed += 1;
  }
  return completed;
}
