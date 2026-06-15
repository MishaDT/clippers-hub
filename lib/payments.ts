import { randomUUID } from "node:crypto";

type PaymentInput = {
  amountCents: number;
  userId: string;
  provider: "yookassa" | "stripe";
  description: string;
};

export async function createPaymentIntent(input: PaymentInput) {
  const configured =
    input.provider === "yookassa"
      ? Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY)
      : Boolean(process.env.STRIPE_SECRET_KEY);

  if (!configured) {
    return {
      provider: input.provider,
      mode: "demo",
      id: `demo_${input.provider}_${randomUUID()}`,
      checkoutUrl: `/wallet?demoPayment=${input.provider}`,
      status: "PENDING"
    };
  }

  return {
    provider: input.provider,
    mode: "ready",
    id: `ready_${input.provider}_${randomUUID()}`,
    checkoutUrl: `/wallet?provider=${input.provider}&status=ready`,
    status: "PENDING",
    note: "Provider credentials are present. Replace this adapter body with the production SDK call."
  };
}
