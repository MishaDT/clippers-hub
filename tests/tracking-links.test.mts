import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTrackingTarget } from "../lib/tracking-links.ts";

test("tracking targets accept public HTTPS and remove fragments", () => {
  assert.equal(normalizeTrackingTarget("https://example.com/offer?a=1#private"), "https://example.com/offer?a=1");
});

test("tracking targets reject credentials and internal destinations", () => {
  assert.equal(normalizeTrackingTarget("https://user:pass@example.com"), null);
  assert.equal(normalizeTrackingTarget("https://localhost/admin"), null);
  assert.equal(normalizeTrackingTarget("https://127.0.0.1/admin"), null);
  assert.equal(normalizeTrackingTarget("http://example.com"), null);
});
