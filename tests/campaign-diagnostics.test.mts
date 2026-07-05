import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseCampaign } from "../lib/campaign-diagnostics.ts";

const now = new Date("2026-07-05T12:00:00.000Z");
const base = {
  id: "campaign-1",
  status: "ACTIVE",
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  deadline: new Date("2026-07-12T10:00:00.000Z"),
  remainingBudgetCents: 50_000,
  reservedBudgetCents: 0,
  grossPayoutCents: 10_000,
  slotsLeft: 3,
  submissions: []
};

test("finds a campaign without workers after 48 hours", () => {
  const result = diagnoseCampaign(base, now);
  assert.equal(result[0].tone, "warning");
  assert.match(result[0].title, /48/);
});

test("finds insufficient free budget", () => {
  const result = diagnoseCampaign({ ...base, remainingBudgetCents: 5_000 }, now);
  assert.ok(result.some((item) => item.tone === "critical" && item.href === "/wallet"));
});

test("finds a stale accepted submission", () => {
  const result = diagnoseCampaign({
    ...base,
    submissions: [{
      status: "ACCEPTED",
      draftStatus: "NOT_SUBMITTED",
      currentViews: 0,
      fraudScore: 0,
      createdAt: new Date("2026-07-02T10:00:00.000Z"),
      updatedAt: new Date("2026-07-03T10:00:00.000Z")
    }]
  }, now);
  assert.ok(result.some((item) => item.title.includes("ждёт продолжения")));
});

test("healthy active campaign gets an honest good state", () => {
  const result = diagnoseCampaign({
    ...base,
    createdAt: new Date("2026-07-05T10:00:00.000Z"),
    submissions: [{
      status: "POSTED",
      draftStatus: "APPROVED",
      currentViews: 2_000,
      fraudScore: 0,
      createdAt: now,
      updatedAt: now
    }]
  }, now);
  assert.deepEqual(result.map((item) => item.tone), ["good"]);
});
