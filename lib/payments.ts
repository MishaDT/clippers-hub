import { randomUUID } from "node:crypto";

type PaymentInput = {
  amountCents: number;
  userId: string;
  provider: "yookassa" | "stripe";
  description: string;
};

function publicBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.OAUTH_REDIRECT_BASE || "https://clippers-hub.vercel.app").replace(/\/$/, "");
}

function rubAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

async function createStripeCheckout(input: PaymentInput) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${publicBaseUrl()}/wallet?payment=stripe_success`);
  params.set("cancel_url", `${publicBaseUrl()}/wallet?payment=stripe_cancel`);
  params.set("client_reference_id", input.userId);
  params.set("metadata[userId]", input.userId);
  params.set("metadata[source]", "wallet_deposit");
  params.set("line_items[0][price_data][currency]", "rub");
  params.set("line_items[0][price_data][product_data][name]", input.description);
  params.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  params.set("line_items[0][quantity]", "1");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe failed: ${response.status}`);

  return {
    provider: "stripe" as const,
    mode: "live" as const,
    id: String(data.id),
    checkoutUrl: String(data.url),
    status: String(data.payment_status || data.status || "PENDING"),
    raw: data
  };
}

async function createYooKassaPayment(input: PaymentInput) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return null;

  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID()
    },
    body: JSON.stringify({
      amount: { value: rubAmount(input.amountCents), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: `${publicBaseUrl()}/wallet?payment=yookassa_return` },
      description: input.description.slice(0, 128),
      metadata: { userId: input.userId, source: "wallet_deposit" }
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.description || `YooKassa failed: ${response.status}`);

  return {
    provider: "yookassa" as const,
    mode: "live" as const,
    id: String(data.id),
    checkoutUrl: String(data.confirmation?.confirmation_url || `${publicBaseUrl()}/wallet?payment=yookassa_no_confirmation`),
    status: String(data.status || "PENDING"),
    raw: data
  };
}

export async function createPaymentIntent(input: PaymentInput) {
  const liveIntent = input.provider === "yookassa" ? await createYooKassaPayment(input) : await createStripeCheckout(input);

  if (!liveIntent) {
    return {
      provider: input.provider,
      mode: "demo",
      id: `demo_${input.provider}_${randomUUID()}`,
      checkoutUrl: `/wallet?demoPayment=${input.provider}`,
      status: "PENDING"
    };
  }

  return liveIntent;
}
