import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { depositProofMatches, type DepositProof } from "@/lib/payment-proof";
import { readTextWithLimit } from "@/lib/request-json";

function safeJson(value: string) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

async function pendingDeposit(provider: string, providerPaymentId: string) {
  return prisma.transaction.findFirst({
    where: { provider, providerRef: providerPaymentId, type: "DEPOSIT", status: "PENDING" }
  });
}

async function completeDeposit(
  tx: NonNullable<Awaited<ReturnType<typeof pendingDeposit>>>,
  proof: DepositProof
) {
  if (!depositProofMatches(tx, proof)) {
    return { completed: false, reason: "payment_proof_mismatch" };
  }

  // Atomic claim: only the caller that actually flips this transaction PENDING -> COMPLETED
  // is allowed to credit the balance. A concurrent or replayed webhook updates 0 rows and
  // credits nothing, so a payment can never be deposited twice.
  const credited = await prisma.$transaction(async (db) => {
    const claim = await db.transaction.updateMany({
      where: { id: tx.id, status: "PENDING" },
      data: { status: "COMPLETED" }
    });
    if (claim.count === 0) return false;
    await db.user.update({ where: { id: tx.userId }, data: { balanceCents: { increment: tx.netCents } } });
    return true;
  });
  return credited
    ? { completed: true, transactionId: tx.id }
    : { completed: false, reason: "already_completed" };
}

export function verifyStripeSignature(body: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  const parts = signature.split(",").map((item) => item.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const candidates = parts.filter(([key, value]) => key === "v1" && value).map(([, value]) => value);
  if (!timestamp || candidates.length === 0) return false;
  // Reject replays outside a 5-minute window.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const actual = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return candidates.some((candidate) => (
    actual.length === candidate.length
    && timingSafeEqual(Buffer.from(actual), Buffer.from(candidate))
  ));
}

// YooKassa has no HMAC signature, so never trust the webhook body — re-fetch the
// payment from the API and only credit if it is genuinely paid.
async function verifiedYooKassaProof(paymentId: string): Promise<DepositProof | null> {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return null;
  const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal,
      cache: "no-store"
    });
    if (!res.ok) return null;
    const data = JSON.parse(await readTextWithLimit(res, 256_000));
    if (data?.status !== "succeeded" || data?.paid !== true) return null;
    const amountCents = Math.round(Number(data?.amount?.value) * 100);
    return {
      amountCents,
      currency: String(data?.amount?.currency || ""),
      userId: String(data?.metadata?.userId || ""),
      source: String(data?.metadata?.source || "")
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleStripeWebhook(body: string) {
  const event = safeJson(body);
  if (event.type !== "checkout.session.completed") return { ignored: true, type: event.type };
  const session = event.data?.object;
  if (!session?.id || session.payment_status !== "paid") return { ignored: true, type: event.type };
  const tx = await pendingDeposit("stripe", String(session.id));
  if (!tx) return { completed: false, reason: "transaction_not_found" };
  return completeDeposit(tx, {
    amountCents: Number(session.amount_total),
    currency: String(session.currency || ""),
    userId: String(session.client_reference_id || session.metadata?.userId || ""),
    source: String(session.metadata?.source || "")
  });
}

export async function handleYooKassaWebhook(body: string) {
  const event = safeJson(body);
  const payment = event.object;
  if (!payment?.id || payment.status !== "succeeded") return { ignored: true, event: event.event };
  const tx = await pendingDeposit("yookassa", String(payment.id));
  if (!tx) return { completed: false, reason: "transaction_not_found" };
  const proof = await verifiedYooKassaProof(String(payment.id));
  if (!proof) {
    return { verified: false, reason: "yookassa_verify_failed" };
  }
  return completeDeposit(tx, proof);
}
