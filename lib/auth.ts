import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "clippers_session";
const BCRYPT_COST = 12;
const DUMMY_PASSWORD_HASH = "$2b$12$FB24uLHLt.zoJmNQC.tZVezEFQcBLBJgCbJR3nQpiWxC/oMAq2iae";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to a 32+ char random string in production");
  }
  return "dev-only-insecure-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
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
  const payload = `${userId}.${createdAt}.${nonce}`;
  const signature = sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Cached per request: AppShell + page can both read the user without a second DB hit.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const payload = parts.slice(0, 3).join(".");
  const signature = parts[3];
  const expected = sign(payload);
  const ok = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) return null;

  const [userId, createdAt] = parts;
  if (Date.now() - Number(createdAt) > 60 * 60 * 24 * 30 * 1000) return null;

  return prisma.user.findUnique({ where: { id: userId } });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function canManageClient(role: string) {
  return role === "CLIENT" || role === "BOTH" || role === "ADMIN";
}

export function canWork(role: string) {
  return role === "WORKER" || role === "BOTH" || role === "ADMIN";
}
