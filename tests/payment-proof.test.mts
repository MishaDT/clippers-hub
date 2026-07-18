import assert from "node:assert/strict";
import test from "node:test";
import { depositProofMatches } from "../lib/payment-proof.ts";

const transaction = { amountCents: 15_000, userId: "user_1" };

test("deposit proof must match amount, currency, owner and source", () => {
  assert.equal(depositProofMatches(transaction, {
    amountCents: 15_000,
    currency: "rub",
    userId: "user_1",
    source: "wallet_deposit"
  }), true);
});

test("deposit proof fails closed on mismatched payment data", () => {
  for (const proof of [
    { amountCents: 1, currency: "RUB", userId: "user_1", source: "wallet_deposit" },
    { amountCents: 15_000, currency: "USD", userId: "user_1", source: "wallet_deposit" },
    { amountCents: 15_000, currency: "RUB", userId: "user_2", source: "wallet_deposit" },
    { amountCents: 15_000, currency: "RUB", userId: "user_1", source: "other" }
  ]) assert.equal(depositProofMatches(transaction, proof), false);
});
