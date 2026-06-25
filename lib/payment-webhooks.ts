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
  // Reject replays outside a 5-minute window.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const actual = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

// YooKassa has no HMAC signature, so never trust the webhook body — re-fetch the
// payment from the API and only credit if it is genuinely paid.
async function yooKassaPaymentSucceeded(paymentId: string) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return false;
  const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
  try {
    const res = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === "succeeded" && data?.paid === true;
  } catch {
    return false;
  }
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
  if (!(await yooKassaPaymentSucceeded(String(payment.id)))) {
    return { verified: false, reason: "yookassa_verify_failed" };
  }
  return completeDepositByProviderId("yookassa", String(payment.id));
}
