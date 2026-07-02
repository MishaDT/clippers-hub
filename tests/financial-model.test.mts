import assert from "node:assert/strict";
import test from "node:test";
import { commissionRate, expectedPayout, grossPayout } from "../lib/money.ts";
import { nextCampaignStatusAfterReservation } from "../lib/reservation-rules.ts";

test("client reserve and clipper payout use the same gross result", () => {
  assert.equal(grossPayout(10_000, 5_000), 50_000);
  assert.equal(expectedPayout(10_000, 5_000, "BRONZE"), 42_500);
  assert.equal(expectedPayout(10_000, 5_000, "LEGENDARY"), 46_500);
});

test("commission is rank-specific and never changes the client reserve", () => {
  assert.equal(commissionRate("BRONZE"), 0.15);
  assert.equal(commissionRate("LEGENDARY"), 0.07);
  assert.equal(grossPayout(25_000, 4_500), 112_500);
});

test("campaign pauses when the last paid slot is reserved", () => {
  assert.equal(nextCampaignStatusAfterReservation({
    currentStatus: "ACTIVE",
    nextRemaining: 100_000,
    reserve: 50_000,
    occupiedAfter: 3,
    maxPaidResults: 3
  }), "PAUSED");
});

test("campaign reports low budget when another full result cannot be reserved", () => {
  assert.equal(nextCampaignStatusAfterReservation({
    currentStatus: "ACTIVE",
    nextRemaining: 49_999,
    reserve: 50_000,
    occupiedAfter: 1,
    maxPaidResults: 3
  }), "LOW_BUDGET");
});
