import assert from "node:assert/strict";
import test from "node:test";
import { createReferralCookie, verifyReferralCookie } from "../lib/referral-attribution.ts";

test("signed referral cookie keeps a valid code", () => {
  const cookie = createReferralCookie("TEST_CODE", 30);
  assert.equal(verifyReferralCookie(cookie), "TEST_CODE");
});

test("tampered referral cookie is rejected", () => {
  const cookie = createReferralCookie("TEST_CODE", 30);
  assert.equal(verifyReferralCookie(cookie.replace("TEST_CODE", "EVIL_CODE")), null);
});
