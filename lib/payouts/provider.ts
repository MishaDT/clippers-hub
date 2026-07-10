// Payout provider abstraction for paying clippers as self-employed (самозанятые).
// No provider is wired yet: selecting one and adding its keys is all that's needed later.
// This module is DB-agnostic — callers pass the payout details and persist the result.

export type PayoutStatus = "PROCESSING" | "PAID" | "FAILED";

export type PayoutRequest = {
  transactionId: string;
  amountCents: number;
  inn: string;
  account: string;
  bik: string;
  fullName: string;
  phone: string;
};

export type PayoutResult = {
  externalId: string;
  status: PayoutStatus;
  receiptUrl?: string;
  error?: string;
};

export interface PayoutProvider {
  readonly name: string;
  createPayout(request: PayoutRequest): Promise<PayoutResult>;
  getStatus(externalId: string): Promise<PayoutResult>;
}

// Dev/preview provider: instantly "pays" and returns a fake НПД receipt URL.
// Never active in production unless PAYOUT_PROVIDER is explicitly "mock".
class MockPayoutProvider implements PayoutProvider {
  readonly name = "mock";
  async createPayout(request: PayoutRequest): Promise<PayoutResult> {
    const externalId = `mock_${request.transactionId}`;
    return { externalId, status: "PAID", receiptUrl: `https://example.invalid/receipt/${externalId}` };
  }
  async getStatus(externalId: string): Promise<PayoutResult> {
    return { externalId, status: "PAID", receiptUrl: `https://example.invalid/receipt/${externalId}` };
  }
}

// Placeholder for the first real aggregator (Konsol / Jump.Finance / Qugo). Throws until
// implemented so a misconfigured prod fails loudly instead of silently "paying".
class UnconfiguredPayoutProvider implements PayoutProvider {
  constructor(readonly name: string) {}
  async createPayout(): Promise<PayoutResult> {
    throw new Error(`Payout provider "${this.name}" is selected but not implemented yet`);
  }
  async getStatus(): Promise<PayoutResult> {
    throw new Error(`Payout provider "${this.name}" is selected but not implemented yet`);
  }
}

export function payoutProviderConfigured(): boolean {
  const name = process.env.PAYOUT_PROVIDER;
  // No production payout adapter is implemented yet. Never report a provider as
  // ready merely because arbitrary environment variables exist.
  return process.env.NODE_ENV !== "production" && name === "mock";
}

export function payoutReadiness() {
  const provider = process.env.PAYOUT_PROVIDER || "manual";
  const automated = payoutProviderConfigured();
  return {
    provider,
    automated,
    manualReviewRequired: !automated,
    message: automated
      ? "Тестовый адаптер доступен только вне production."
      : "Автоматический провайдер не подключён: разрешены только ручные выплаты с номером перевода и журналом действий."
  };
}

export function getPayoutProvider(): PayoutProvider | null {
  const name = process.env.PAYOUT_PROVIDER;
  if (!name) return null;
  if (name === "mock") {
    // Guard against a mock accidentally moving real money in production.
    if (process.env.NODE_ENV === "production") return null;
    return new MockPayoutProvider();
  }
  return new UnconfiguredPayoutProvider(name);
}
