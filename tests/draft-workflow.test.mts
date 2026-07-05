import test from "node:test";
import assert from "node:assert/strict";
import { initialDraftDecision, nextDraftRevision, validateDraftUrl } from "../lib/draft-workflow.ts";

test("fast mode only auto-approves trusted clippers", () => {
  assert.equal(initialDraftDecision({ reviewMode: "FAST", trustScore: 90 }), "APPROVED");
  assert.equal(initialDraftDecision({ reviewMode: "FAST", trustScore: 89 }), "PENDING");
  assert.equal(initialDraftDecision({ reviewMode: "STANDARD", trustScore: 100 }), "PENDING");
  assert.equal(initialDraftDecision({ reviewMode: "STRICT", trustScore: 100 }), "PENDING");
});

test("revision counter enforces the campaign limit", () => {
  assert.equal(nextDraftRevision("NOT_SUBMITTED", 0, 2), 0);
  assert.equal(nextDraftRevision("CHANGES_REQUESTED", 0, 2), 1);
  assert.equal(nextDraftRevision("CHANGES_REQUESTED", 1, 2), 2);
  assert.equal(nextDraftRevision("CHANGES_REQUESTED", 2, 2), null);
  assert.equal(nextDraftRevision("PENDING", 0, 2), null);
  assert.equal(nextDraftRevision("APPROVED", 0, 2), null);
});

test("draft links require public credential-free HTTPS URLs", () => {
  assert.equal(validateDraftUrl("http://example.org/video"), null);
  assert.equal(validateDraftUrl("https://localhost/video"), null);
  assert.equal(validateDraftUrl("https://127.0.0.1/video"), null);
  assert.equal(validateDraftUrl("https://user:pass@example.org/video"), null);
  assert.equal(validateDraftUrl("https://drive.google.com/file/d/abc/view"), "https://drive.google.com/file/d/abc/view");
});
