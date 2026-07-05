import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.OAUTH_REDIRECT_BASE || "https://clippers-hub.vercel.app").replace(/\/$/, "");
}

export function emailDeliveryReady() {
  const key = process.env.RESEND_API_KEY?.trim() || "";
  const from = process.env.EMAIL_FROM?.trim() || "";
  return key.startsWith("re_") && key.length >= 20 && from.includes("@");
}

export async function createEmailVerification(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
      }
    })
  ]);
  return token;
}

export async function sendEmailVerification(input: { userId: string; email: string; name: string; returnTo?: string }) {
  if (!emailDeliveryReady()) return { sent: false as const, reason: "not_configured" as const };

  try {
    const token = await createEmailVerification(input.userId);
    const query = new URLSearchParams({ token });
    if (input.returnTo) query.set("returnTo", input.returnTo);
    const verifyUrl = `${publicBaseUrl()}/api/auth/verify-email?${query}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [input.email],
        subject: "Подтвердите email в ReelPay",
        text: `Здравствуйте, ${input.name}. Подтвердите email в течение 24 часов: ${verifyUrl}`
      }),
      cache: "no-store"
    });

    if (!response.ok) return { sent: false as const, reason: "provider_error" as const };
    return { sent: true as const };
  } catch {
    return { sent: false as const, reason: "provider_error" as const };
  }
}

export async function consumeEmailVerification(token: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return false;
  const hash = tokenHash(token);

  return prisma.$transaction(async (tx) => {
    const verification = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
    if (!verification || verification.usedAt || verification.expiresAt <= new Date()) return false;

    const claimed = await tx.emailVerificationToken.updateMany({
      where: { id: verification.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });
    if (claimed.count !== 1) return false;

    await tx.user.update({
      where: { id: verification.userId },
      data: { emailVerifiedAt: new Date() }
    });
    return true;
  });
}
