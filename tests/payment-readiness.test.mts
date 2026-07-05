import assert from "node:assert/strict";
import test from "node:test";
import {
  availablePaymentProviders,
  isPaymentProvider,
  paymentProviderStatuses,
  stripeWebhookReady
} from "../lib/payment-readiness.ts";

const keys = [
  "DEMO_PAYMENTS",
  "YOOKASSA_SHOP_ID",
  "YOOKASSA_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
] as const;

function withEnvironment(values: Partial<Record<(typeof keys)[number], string>>, run: () => void) {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  keys.forEach((key) => delete process.env[key]);
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    keys.forEach((key) => {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
}

test("payment providers reject missing and placeholder credentials", () => {
  withEnvironment({
    YOOKASSA_SHOP_ID: "your_shop_id",
    YOOKASSA_SECRET_KEY: "secret",
    STRIPE_SECRET_KEY: "sk_test_placeholder"
  }, () => {
    assert.equal(availablePaymentProviders().length, 0);
    assert.equal(paymentProviderStatuses().every((provider) => !provider.live), true);
  });
});

test("payment providers accept credentials with valid public shape", () => {
  withEnvironment({
    YOOKASSA_SHOP_ID: "123456",
    YOOKASSA_SECRET_KEY: "live_secret_value_1234567890",
    STRIPE_SECRET_KEY: ["sk", "live", "x".repeat(24)].join("_"),
    STRIPE_WEBHOOK_SECRET: ["whsec", "x".repeat(24)].join("_")
  }, () => {
    assert.deepEqual(availablePaymentProviders().map((provider) => provider.id), ["yookassa", "stripe"]);
    assert.equal(stripeWebhookReady(), true);
  });
});

test("explicit demo mode enables checkout without pretending it is live", () => {
  withEnvironment({ DEMO_PAYMENTS: "1" }, () => {
    const statuses = paymentProviderStatuses();
    assert.equal(statuses.every((provider) => provider.available), true);
    assert.equal(statuses.every((provider) => !provider.live), true);
  });
});

test("provider allowlist rejects arbitrary form values", () => {
  assert.equal(isPaymentProvider("stripe"), true);
  assert.equal(isPaymentProvider("yookassa"), true);
  assert.equal(isPaymentProvider("attacker"), false);
});
