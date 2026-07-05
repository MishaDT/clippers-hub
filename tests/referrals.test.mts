import assert from "node:assert/strict";
import test from "node:test";
import { referralCommissionCents, selectReferralTier } from "../lib/referral-rules.ts";

const tiers = [
  { title: "Старт", minActiveReferrals: 1, rateBps: 500 },
  { title: "Партнёр", minActiveReferrals: 5, rateBps: 1000 },
  { title: "Профи", minActiveReferrals: 20, rateBps: 1500 },
  { title: "Амбассадор", minActiveReferrals: 50, rateBps: 2000 }
];

test("selects the highest reached referral tier", () => {
  assert.equal(selectReferralTier(tiers, 1)?.rateBps, 500);
  assert.equal(selectReferralTier(tiers, 20)?.rateBps, 1500);
  assert.equal(selectReferralTier(tiers, 0), null);
});

test("commission is a percentage of the platform fee", () => {
  assert.equal(referralCommissionCents(15_000, 1000), 1_500);
});

test("commission rate is hard-capped at 25 percent", () => {
  assert.equal(referralCommissionCents(10_000, 9000), 2_500);
});
