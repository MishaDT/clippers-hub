import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeAnalyticsMetadata } from "../lib/analytics-metadata.ts";

test("analytics metadata removes contact details and secrets", () => {
  assert.deepEqual(sanitizeAnalyticsMetadata({
    email: "person@example.com",
    token: "abc",
    note: "write to person@example.com",
    source: "campaign",
    campaignId: "cm_test"
  }), {
    email: "[redacted]",
    token: "[redacted]",
    note: "[redacted]",
    source: "campaign",
    campaignId: "cm_test"
  });
});

test("analytics metadata bounds nested and long client values", () => {
  const result = sanitizeAnalyticsMetadata({
    nested: { deeper: { value: "private" } },
    long: "x".repeat(300)
  });
  assert.deepEqual(result.nested, { deeper: "[truncated]" });
  assert.equal(String(result.long).length, 160);
});
