import assert from "node:assert/strict";
import test from "node:test";
import { hasCompletePayoutDetails, normalizePayoutDetails } from "../lib/payout-details.ts";

const valid = {
  payoutFullName: "Иван Иванович Иванов",
  payoutInn: "123456789012",
  payoutAccount: "12345678901234567890",
  payoutBik: "123456789",
  payoutPhone: "+7 (999) 123-45-67"
};

test("payout details normalize harmless formatting", () => {
  assert.deepEqual(normalizePayoutDetails(valid), {
    ...valid,
    payoutPhone: "79991234567"
  });
});

test("payout details reject incomplete banking data", () => {
  assert.equal(normalizePayoutDetails({ ...valid, payoutInn: "123" }), null);
  assert.equal(normalizePayoutDetails({ ...valid, payoutAccount: "" }), null);
});

test("withdrawal readiness also requires self-employed confirmation", () => {
  assert.equal(hasCompletePayoutDetails({ ...valid, selfEmployedConfirmedAt: null }), false);
  assert.equal(hasCompletePayoutDetails({ ...valid, selfEmployedConfirmedAt: new Date() }), true);
});
