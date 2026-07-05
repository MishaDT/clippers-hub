import assert from "node:assert/strict";
import test from "node:test";
import { evaluateViewRisk } from "../lib/view-validation.ts";

test("normal provider growth has a low deterministic risk", () => {
  const input = {
    previousViews: 8_000,
    observedViews: 10_000,
    views: 10_000,
    likes: 500,
    comments: 20,
    elapsedSeconds: 3_600,
    ownershipVerified: true
  };
  assert.deepEqual(evaluateViewRisk(input), evaluateViewRisk(input));
  assert.equal(evaluateViewRisk(input).fraudScore, 5);
  assert.equal(evaluateViewRisk(input).requiresReview, false);
});

test("explosive growth with no engagement requires manual review", () => {
  const result = evaluateViewRisk({
    previousViews: 1_000,
    observedViews: 251_000,
    views: 251_000,
    likes: 0,
    comments: 0,
    elapsedSeconds: 300,
    ownershipVerified: true
  });
  assert.equal(result.requiresReview, true);
  assert.ok(result.reasons.includes("explosive_growth"));
  assert.ok(result.reasons.includes("zero_engagement"));
});

test("missing ownership freezes progress without alleging fraud by itself", () => {
  const result = evaluateViewRisk({
    previousViews: 2_000,
    observedViews: 2_500,
    views: 2_500,
    likes: 100,
    comments: 4,
    elapsedSeconds: 1_800,
    ownershipVerified: false
  });
  assert.equal(result.fraudScore, 60);
  assert.equal(result.requiresReview, false);
  assert.deepEqual(result.reasons, ["ownership_missing"]);
});

test("provider metric decrease is retained as a review signal", () => {
  const result = evaluateViewRisk({
    previousViews: 10_000,
    observedViews: 7_000,
    views: 10_000,
    likes: 300,
    comments: 10,
    elapsedSeconds: 3_600,
    ownershipVerified: true
  });
  assert.ok(result.reasons.includes("provider_views_decreased"));
  assert.equal(result.fraudScore, 35);
});
