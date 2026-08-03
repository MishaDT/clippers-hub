import assert from "node:assert/strict";
import test from "node:test";
import { calculateCampaignPerformance } from "../lib/campaign-performance.ts";

test("campaign performance builds the full business funnel", () => {
  assert.deepEqual(
    calculateCampaignPerformance({
      views: 10_000,
      clicks: 500,
      spentCents: 100_000,
      leads: 50,
      sales: 10,
      revenueCents: 300_000
    }),
    {
      ctrPercent: 5,
      costPerClickCents: 200,
      costPerLeadCents: 2_000,
      costPerSaleCents: 10_000,
      roasPercent: 300
    }
  );
});

test("campaign performance returns unavailable ratios instead of fake zeroes", () => {
  assert.deepEqual(
    calculateCampaignPerformance({
      views: 0,
      clicks: 0,
      spentCents: 0,
      leads: 0,
      sales: 0,
      revenueCents: 0
    }),
    {
      ctrPercent: null,
      costPerClickCents: null,
      costPerLeadCents: null,
      costPerSaleCents: null,
      roasPercent: null
    }
  );
});
