import "server-only";

import { createHash, randomBytes } from "node:crypto";

export type ProviderId = "google" | "vk" | "yandex";

export type OAuthProfile = {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatar: string | null;
};

type ProviderConfig = {
  id: ProviderId;
  label: string;
  scope: string;
  authorizeUrl: string;
  clientId?: string;
  clientSecret?: string;
};

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  google: {
    id: "google",
    label: "Google",
    scope: "openid email profile",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  },
  yandex: {
    id: "yandex",
    label: "Yandex",
    scope: "login:email login:info",
    authorizeUrl: "https://oauth.yandex.ru/authorize",
    clientId: process.env.YANDEX_CLIENT_ID,
    clientSecret: process.env.YANDEX_CLIENT_SECRET
  },
  vk: {
    id: "vk",
    label: "VK ID",
    scope: "email",
    authorizeUrl: "https://id.vk.com/authorize",
    clientId: process.env.VK_CLIENT_ID,
    clientSecret: process.env.VK_CLIENT_SECRET
  }
};

const PROVIDER_ORDER: ProviderId[] = ["google", "vk", "yandex"];

export function isProvider(value: string): value is ProviderId {
  return value === "google" || value === "vk" || value === "yandex";
}

export function isConfigured(id: ProviderId) {
  const provider = PROVIDERS[id];
  return Boolean(provider?.clientId && provider?.clientSecret);
}

export function enabledProviders(): ProviderId[] {
  return PROVIDER_ORDER.filter(isConfigured);
}

// PKCE: random verifier + its SHA-256 challenge (protects the code exchange).
export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function randomState() {
  return randomBytes(16).toString("base64url");
}

// The redirect URI must match EXACTLY what's registered in the provider console,
// so we prefer an explicit env base over the (proxy-mangled) request origin.
export function redirectBase(requestUrl: string) {
  const env = process.env.OAUTH_REDIRECT_BASE || process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const url = new URL(requestUrl);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url.origin;
}

export function callbackUri(requestUrl: string, id: ProviderId) {
  return `${redirectBase(requestUrl)}/api/auth/oauth/${id}/callback`;
}

export function buildAuthorizeUrl(
  id: ProviderId,
  opts: { redirectUri: string; state: string; challenge: string }
) {
  const provider = PROVIDERS[id];
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("client_id", provider.clientId as string);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scope);
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (id === "google") {
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("access_type", "online");
  }
  return url.toString();
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Exchange the authorization code for tokens and return the normalized profile.
// We deliberately do NOT persist any token — only the identity is needed at login.
export async function exchangeAndFetchProfile(
  id: ProviderId,
  opts: { code: string; redirectUri: string; verifier: string; deviceId?: string }
): Promise<OAuthProfile> {
  const provider = PROVIDERS[id];
  const clientId = provider.clientId as string;
  const clientSecret = provider.clientSecret as string;

  if (id === "vk") {
    return vkProfile({ ...opts, clientId, clientSecret });
  }

  const tokenUrl = id === "google" ? "https://oauth2.googleapis.com/token" : "https://oauth.yandex.ru/token";
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: opts.verifier
    })
  });
  const tokens = await readJson(tokenRes);
  const accessToken: string | undefined = tokens.access_token;
  if (!tokenRes.ok || !accessToken) throw new Error(`token_exchange_failed:${id}`);

  if (id === "google") {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const u = await readJson(res);
    if (!res.ok || !u.sub) throw new Error("google_userinfo_failed");
    return {
      providerAccountId: String(u.sub),
      email: u.email ?? null,
      emailVerified: u.email_verified === true || u.email_verified === "true",
      name: u.name ?? null,
      avatar: u.picture ?? null
    };
  }

  // Yandex
  const res = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${accessToken}` }
  });
  const u = await readJson(res);
  if (!res.ok || !u.id) throw new Error("yandex_userinfo_failed");
  const email: string | null = u.default_email ?? (Array.isArray(u.emails) ? u.emails[0] : null) ?? null;
  const avatar =
    u.default_avatar_id && u.is_avatar_empty !== true
      ? `https://avatars.yandex.net/get-yapic/${u.default_avatar_id}/islands-200`
      : null;
  return {
    providerAccountId: String(u.id),
    email,
    emailVerified: Boolean(email), // Yandex only returns the account's confirmed email
    name: u.real_name || u.display_name || null,
    avatar
  };
}

// VK ID (OAuth 2.1) uses a separate token + user_info endpoint and a device_id.
async function vkProfile(opts: {
  code: string;
  redirectUri: string;
  verifier: string;
  deviceId?: string;
  clientId: string;
  clientSecret: string;
}): Promise<OAuthProfile> {
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    code_verifier: opts.verifier,
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri
  });
  if (opts.deviceId) tokenBody.set("device_id", opts.deviceId);
  if (opts.clientSecret) tokenBody.set("client_secret", opts.clientSecret);

  const tokenRes = await fetch("https://id.vk.com/oauth2/auth", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody
  });
  const tokens = await readJson(tokenRes);
  const accessToken: string | undefined = tokens.access_token;
  if (!tokenRes.ok || !accessToken) throw new Error("vk_token_exchange_failed");

  const infoRes = await fetch("https://id.vk.com/oauth2/user_info", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: accessToken, client_id: opts.clientId })
  });
  const info = await readJson(infoRes);
  const user = info.user ?? {};
  const providerAccountId = String(user.user_id ?? tokens.user_id ?? "");
  if (!providerAccountId) throw new Error("vk_userinfo_failed");
  const email: string | null = tokens.email ?? user.email ?? null;
  return {
    providerAccountId,
    email,
    emailVerified: Boolean(email),
    name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
    avatar: user.avatar ?? null
  };
}
