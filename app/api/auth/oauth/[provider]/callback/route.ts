import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSession, getCurrentUser, hashPassword } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { callbackUri, exchangeAndFetchProfile, isConfigured, isProvider, redirectBase } from "@/lib/oauth";
import { parseAuthIntent, safeAuthReturnTo } from "@/lib/auth-intent";
import { ROLE_MODE_COOKIE } from "@/lib/role-mode";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const base = redirectBase(request.url);
  const fail = async (code: string) => {
    await trackEvent({ request, type: "OAUTH_FAILED", path: "/login", provider, metadata: { reason: code } });
    return NextResponse.redirect(new URL(`/login?error=${code}`, base), 303);
  };

  if (!isProvider(provider) || !isConfigured(provider)) return fail("oauth_failed");

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return fail("oauth_denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const deviceId = url.searchParams.get("device_id") ?? undefined; // VK ID passes this back
  if (!code || !state) return fail("oauth_failed");

  const jar = await cookies();
  const cookieState = jar.get("oauth_state")?.value;
  const verifier = jar.get("oauth_verifier")?.value;
  const cookieProvider = jar.get("oauth_provider")?.value;
  const intent = jar.get("oauth_intent")?.value === "link" ? "link" : "login";
  const roleIntent = parseAuthIntent(jar.get("oauth_role_intent")?.value);
  const requestedReturnTo = jar.get("oauth_return_to")?.value;
  jar.delete("oauth_state");
  jar.delete("oauth_verifier");
  jar.delete("oauth_provider");
  jar.delete("oauth_intent");
  jar.delete("oauth_role_intent");
  jar.delete("oauth_return_to");
  if (!cookieState || !verifier || cookieState !== state || cookieProvider !== provider) return fail("oauth_state");

  let profile;
  try {
    profile = await exchangeAndFetchProfile(provider, {
      code,
      redirectUri: callbackUri(request.url, provider),
      verifier,
      deviceId
    });
  } catch {
    return fail("oauth_failed");
  }

  try {
    const linked = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
      include: { user: true }
    });

    if (intent === "link") {
      const currentUser = await getCurrentUser();
      if (!currentUser) return fail("oauth_state");
      if (linked && linked.userId !== currentUser.id) return fail("oauth_taken");
      if (!linked) {
        await prisma.oAuthAccount.create({
          data: { userId: currentUser.id, provider, providerAccountId: profile.providerAccountId }
        });
      }
      await trackEvent({ request, userId: currentUser.id, type: "OAUTH_LINK", path: "/profile", provider });
      return NextResponse.redirect(new URL("/profile?settings=account", base), 303);
    }

    // Login/create flow only trusts providers that return a verified email.
    if (!profile.email || !profile.emailVerified) return fail("oauth_no_email");
    const email = profile.email.toLowerCase();

    let user = linked?.user ?? null;
    let createdUser = false;
    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        const handleBase = email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 12) || "user";
        const handle = `${handleBase}${Math.floor(Math.random() * 9000 + 1000)}`;
        user = await prisma.user.create({
          data: {
            email,
            name: profile.name || handleBase,
            handle,
            avatar: profile.avatar ?? undefined,
            // OAuth accounts get a random, unusable password hash (password login can't match it).
            passwordHash: await hashPassword(randomBytes(24).toString("hex")),
            role: "BOTH",
            referralCode: handle.toUpperCase().slice(0, 12),
            preferredRoleMode: roleIntent
          }
        });
        createdUser = true;
      }
      await prisma.oAuthAccount.create({
        data: { userId: user.id, provider, providerAccountId: profile.providerAccountId }
      });
    }

    await createSession(user.id);
    const selectedMode = roleIntent || (user.preferredRoleMode === "client" ? "client" : "worker");
    if (roleIntent && user.preferredRoleMode !== roleIntent) {
      await prisma.user.update({ where: { id: user.id }, data: { preferredRoleMode: roleIntent } });
    }
    await trackEvent({
      request,
      userId: user.id,
      type: createdUser ? "OAUTH_REGISTER" : "OAUTH_LOGIN",
      path: "/login",
      provider
    });
    jar.set(ROLE_MODE_COOKIE, selectedMode, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 31536000
    });
    return NextResponse.redirect(new URL(safeAuthReturnTo(requestedReturnTo, selectedMode), base), 303);
  } catch {
    return fail("oauth_failed");
  }
}
