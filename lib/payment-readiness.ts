export type PaymentProvider = "yookassa" | "stripe";

export type PaymentProviderStatus = {
  id: PaymentProvider;
  label: string;
  live: boolean;
  available: boolean;
  missing: string[];
};

function configured(value: string | undefined, pattern: RegExp, minimumLength: number) {
  const normalized = value?.trim() || "";
  return normalized.length >= minimumLength && pattern.test(normalized);
}

export function demoPaymentsEnabled() {
  return process.env.DEMO_PAYMENTS === "1" || process.env.DEMO_PAYMENTS === "true";
}

export function paymentProviderStatuses(): PaymentProviderStatus[] {
  const yooShopReady = configured(process.env.YOOKASSA_SHOP_ID, /^\d+$/, 4);
  const yooSecretReady = configured(process.env.YOOKASSA_SECRET_KEY, /^[A-Za-z0-9_-]+$/, 20);
  const stripeKeyReady = configured(process.env.STRIPE_SECRET_KEY, /^sk_(test|live)_/, 24);
  const stripeHookReady = stripeWebhookReady();
  const stripeReady = stripeKeyReady && stripeHookReady;
  const demo = demoPaymentsEnabled();

  return [
    {
      id: "yookassa",
      label: "ЮKassa",
      live: yooShopReady && yooSecretReady,
      available: (yooShopReady && yooSecretReady) || demo,
      missing: [
        ...(!yooShopReady ? ["YOOKASSA_SHOP_ID"] : []),
        ...(!yooSecretReady ? ["YOOKASSA_SECRET_KEY"] : [])
      ]
    },
    {
      id: "stripe",
      label: "Stripe",
      live: stripeReady,
      available: stripeReady || demo,
      missing: [
        ...(!stripeKeyReady ? ["STRIPE_SECRET_KEY"] : []),
        ...(!stripeHookReady ? ["STRIPE_WEBHOOK_SECRET"] : [])
      ]
    }
  ];
}

export function availablePaymentProviders() {
  return paymentProviderStatuses().filter((provider) => provider.available);
}

export function isPaymentProvider(value: string): value is PaymentProvider {
  return value === "yookassa" || value === "stripe";
}

export function isPaymentProviderAvailable(provider: PaymentProvider) {
  return paymentProviderStatuses().some((item) => item.id === provider && item.available);
}

export function stripeWebhookReady() {
  return configured(process.env.STRIPE_WEBHOOK_SECRET, /^whsec_/, 20);
}
