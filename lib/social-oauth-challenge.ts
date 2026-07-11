import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SOCIAL_OAUTH_BINDER_COOKIE = "social_oauth_binder";

export function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

export function pkceChallenge(verifier: string) {
  return sha256(verifier);
}

export async function createSocialOAuthChallenge(userId: string, platform: Platform) {
  const state = randomBytes(32).toString("base64url");
  const binder = randomBytes(32).toString("base64url");
  const pkceVerifier = randomBytes(48).toString("base64url");
  await prisma.socialOAuthChallenge.create({
    data: {
      userId,
      platform,
      stateHash: sha256(state),
      sessionHash: sha256(binder),
      pkceVerifier,
      expiresAt: new Date(Date.now() + 10 * 60_000)
    }
  });
  return { state, binder, pkceVerifier };
}

export async function consumeSocialOAuthChallenge(input: {
  userId: string;
  platform: Platform;
  state: string;
  binder: string;
}) {
  const stateHash = sha256(input.state);
  const challenge = await prisma.socialOAuthChallenge.findUnique({ where: { stateHash } });
  if (
    !challenge
    || challenge.userId !== input.userId
    || challenge.platform !== input.platform
    || challenge.usedAt
    || challenge.expiresAt.getTime() <= Date.now()
    || challenge.sessionHash !== sha256(input.binder)
  ) {
    if (challenge) await prisma.socialOAuthChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  const consumed = await prisma.socialOAuthChallenge.updateMany({
    where: { id: challenge.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date(), attempts: { increment: 1 } }
  });
  return consumed.count === 1 ? challenge : null;
}
