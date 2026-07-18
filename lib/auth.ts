import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "clippers_session";
const BCRYPT_COST = 12;
const SESSION_TTL_MS = 60 * 60 * 24 * 30 * 1000;
const DUMMY_PASSWORD_HASH = "$2b$12$FB24uLHLt.zoJmNQC.tZVezEFQcBLBJgCbJR3nQpiWxC/oMAq2iae";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to a 32+ char random string in production");
  }
  return "dev-only-insecure-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function verifyPasswordOrDummy(password: string, hash?: string | null) {
  return bcrypt.compare(password, hash || DUMMY_PASSWORD_HASH);
}

export async function createSession(userId: string) {
  const createdAt = Date.now();
  const nonce = randomBytes(12).toString("base64url");
  const payload = `v2.${userId}.${createdAt}.${nonce}`;
  const signature = sign(payload);
  const token = `${payload}.${signature}`;
  await prisma.authSession.create({
    data: {
      id: tokenHash(token),
      userId,
      expiresAt: new Date(createdAt + SESSION_TTL_MS)
    }
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    const revokedAt = new Date();
    const revoked = await prisma.authSession.updateMany({
      where: { id: tokenHash(token), revokedAt: null },
      data: { revokedAt }
    });
    // A legacy cookie may not have been seen since revocable sessions were introduced.
    // Persist a tombstone on logout so a copied legacy bearer token cannot enrol itself
    // later and become valid again.
    if (revoked.count === 0) {
      const parts = token.split(".");
      if (parts[0] !== "v2" && parts.length === 4) {
        const signature = parts[3] || "";
        const payload = parts.slice(0, -1).join(".");
        const expected = sign(payload);
        const createdAt = Number(parts[1]);
        const valid = signature.length === expected.length
          && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
          && Number.isFinite(createdAt)
          && createdAt <= Date.now() + 60_000
          && Date.now() - createdAt <= SESSION_TTL_MS;
        if (valid) {
          const userId = parts[0];
          const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
          if (userExists) {
            await prisma.authSession.upsert({
              where: { id: tokenHash(token) },
              create: {
                id: tokenHash(token),
                userId,
                expiresAt: new Date(createdAt + SESSION_TTL_MS),
                revokedAt
              },
              update: { revokedAt }
            });
          }
        }
      }
    }
  }
  cookieStore.delete(COOKIE_NAME);
}

// Cached per request: AppShell + page can both read the user without a second DB hit.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  const isV2 = parts[0] === "v2";
  if ((isV2 && parts.length !== 5) || (!isV2 && parts.length !== 4)) return null;
  const signature = parts.at(-1) || "";
  const payload = parts.slice(0, -1).join(".");
  const expected = sign(payload);
  const ok = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) return null;

  const userId = isV2 ? parts[1] : parts[0];
  const createdAt = Number(isV2 ? parts[2] : parts[1]);
  if (!Number.isFinite(createdAt) || createdAt > Date.now() + 60_000 || Date.now() - createdAt > SESSION_TTL_MS) return null;

  const id = tokenHash(token);
  let session = await prisma.authSession.findUnique({ where: { id }, include: { user: true } });
  // One-release compatibility for cookies issued before revocable sessions existed.
  // A revoked legacy token leaves a row behind and can therefore never be enrolled again.
  if (!session && !isV2) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    session = await prisma.authSession.upsert({
      where: { id },
      create: { id, userId, expiresAt: new Date(createdAt + SESSION_TTL_MS) },
      update: {},
      include: { user: true }
    });
  }
  if (
    !session
    || session.userId !== userId
    || session.revokedAt
    || session.expiresAt.getTime() <= Date.now()
  ) return null;

  const user = session.user;
  // Immediate revocation: moderated accounts lose access on the next request even if
  // they still hold a valid cookie. This is especially important for admin sessions.
  if (user?.accountStatus === "BANNED" || user?.accountStatus === "FROZEN") return null;
  return user;
});

export async function requireUser() {
  const hadSessionCookie = Boolean((await cookies()).get(COOKIE_NAME)?.value);
  const user = await getCurrentUser();
  if (!user) redirect(hadSessionCookie ? "/login?error=session_expired" : "/login");
  return user;
}

export function canManageClient(role: string) {
  return role === "CLIENT" || role === "BOTH" || role === "ADMIN";
}

export function canWork(role: string) {
  return role === "WORKER" || role === "BOTH" || role === "ADMIN";
}
