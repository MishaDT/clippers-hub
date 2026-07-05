import assert from "node:assert/strict";
import test from "node:test";
import { commissionRate, expectedPayout, grossPayout, minimumGuaranteedPayout, settlementGross, settlementReservationSplit } from "../lib/money.ts";
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

test("minimum guarantee pays a verified result at deadline without exceeding its reserve", () => {
  assert.equal(settlementGross({
    views: 1_000,
    viewThreshold: 10_000,
    cpmRateCents: 5_000,
    minimumGuaranteeCents: 15_000,
    reservedPayoutCents: 50_000,
    deadlineReached: true
  }), 15_000);
  assert.equal(minimumGuaranteedPayout(15_000, "BRONZE"), 12_750);
});

test("actual views can exceed the guarantee but never the reserved maximum", () => {
  assert.equal(settlementGross({
    views: 8_000,
    viewThreshold: 10_000,
    cpmRateCents: 5_000,
    minimumGuaranteeCents: 15_000,
    reservedPayoutCents: 50_000,
    deadlineReached: true
  }), 40_000);
  assert.equal(settlementGross({
    views: 20_000,
    viewThreshold: 10_000,
    cpmRateCents: 5_000,
    minimumGuaranteeCents: 15_000,
    reservedPayoutCents: 50_000,
    deadlineReached: true
  }), 50_000);
});

test("guarantee is not paid before deadline", () => {
  assert.equal(settlementGross({
    views: 1_000,
    viewThreshold: 10_000,
    cpmRateCents: 5_000,
    minimumGuaranteeCents: 15_000,
    reservedPayoutCents: 50_000,
    deadlineReached: false
  }), 0);
});

test("unused guarantee reserve returns to the campaign or owner exactly once", () => {
  assert.deepEqual(settlementReservationSplit({
    reservedPayoutCents: 50_000,
    grossPayoutCents: 15_000,
    campaignCompleted: false
  }), {
    reserved: 50_000,
    gross: 15_000,
    returnToCampaignCents: 35_000,
    refundOwnerCents: 0
  });
  assert.deepEqual(settlementReservationSplit({
    reservedPayoutCents: 50_000,
    grossPayoutCents: 15_000,
    campaignCompleted: true
  }), {
    reserved: 50_000,
    gross: 15_000,
    returnToCampaignCents: 0,
    refundOwnerCents: 35_000
  });
});
