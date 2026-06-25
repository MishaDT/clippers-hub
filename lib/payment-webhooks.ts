import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

function safeJson(value: string) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

async function completeDepositByProviderId(provider: string, providerPaymentId: string) {
  const tx = await prisma.transaction.findFirst({
    where: {
      provider,
      type: "DEPOSIT",
      status: "PENDING",
      providerData: { contains: providerPaymentId }
    }
  });
  if (!tx) return { completed: false, reason: "transaction_not_found" };

  await prisma.$transaction([
    prisma.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETED" } }),
    prisma.user.update({ where: { id: tx.userId }, data: { balanceCents: { increment: tx.netCents } } })
  ]);
  return { completed: true, transactionId: tx.id };
}

export function verifyStripeSignature(body: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  const parts = Object.fromEntries(signature.split(",").map((item) => item.split("=", 2)) as Array<[string, string]>);
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;
  const actual = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function handleStripeWebhook(body: string) {
  const event = safeJson(body);
  if (event.type !== "checkout.session.completed") return { ignored: true, type: event.type };
  const session = event.data?.object;
  if (!session?.id || session.payment_status !== "paid") return { ignored: true, type: event.type };
  return completeDepositByProviderId("stripe", String(session.id));
}

export async function handleYooKassaWebhook(body: string) {
  const event = safeJson(body);
  const payment = event.object;
  if (!payment?.id || payment.status !== "succeeded") return { ignored: true, event: event.event };
  return completeDepositByProviderId("yookassa", String(payment.id));
}
