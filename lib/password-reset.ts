import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth";
import { emailDeliveryReady } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/security";

const TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.OAUTH_REDIRECT_BASE || "https://clippers-hub.vercel.app").replace(/\/$/, "");
}

export async function sendPasswordReset(input: { userId: string; email: string; name: string }) {
  if (!emailDeliveryReady()) return { sent: false as const, reason: "not_configured" as const };

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: input.userId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
      }
    })
  ]);

  try {
    const resetUrl = `${publicBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [input.email],
        subject: "Восстановление доступа к ReelPay",
        text: `Здравствуйте, ${input.name}. Чтобы задать новый пароль, откройте ссылку в течение часа: ${resetUrl}\n\nЕсли вы не запрашивали сброс, ничего делать не нужно.`
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000)
    });

    if (!response.ok) {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash: hashToken(token), usedAt: null } });
      return { sent: false as const, reason: "provider_error" as const };
    }
    return { sent: true as const };
  } catch {
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash: hashToken(token), usedAt: null } }).catch(() => undefined);
    return { sent: false as const, reason: "provider_error" as const };
  }
}

export async function resetPassword(token: string, password: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return "invalid" as const;
  const tokenHash = hashToken(token);
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true } } }
  });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return "invalid" as const;
  if (validatePassword(password, reset.user.email)) return "weak_password" as const;

  const passwordHash = await hashPassword(password);
  const changed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: reset.user.id }, data: { passwordHash } });
    await tx.authSession.updateMany({
      where: { userId: reset.user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return true;
  });
  return changed ? "ok" as const : "invalid" as const;
}
