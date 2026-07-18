import assert from "node:assert/strict";
import test from "node:test";
import { analyticsAllowed } from "../lib/cookie-preferences.ts";

test("analytics requires an explicit positive choice", () => {
  assert.equal(analyticsAllowed(undefined), false);
  assert.equal(analyticsAllowed("necessary"), false);
  assert.equal(analyticsAllowed("analytics"), true);
});

test("legacy all consent remains compatible", () => {
  assert.equal(analyticsAllowed("all"), true);
  assert.equal(analyticsAllowed("unexpected"), false);
});
