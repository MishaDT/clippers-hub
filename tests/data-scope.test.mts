import assert from "node:assert/strict";
import test from "node:test";
import {
  realAnalyticsWhere,
  realSubmissionWhere,
  realTransactionWhere,
  realUserWhere
} from "../lib/data-scope.ts";

test("public data scopes fail closed on explicit demo flags", () => {
  assert.deepEqual(realUserWhere, { isDemo: false });
  assert.equal(realTransactionWhere.isDemo, false);
  assert.deepEqual(realTransactionWhere.user, { isDemo: false });
  assert.deepEqual(realSubmissionWhere.campaign, { isDemo: false });
  assert.deepEqual(realSubmissionWhere.worker, { isDemo: false });
});

test("analytics keeps guests but excludes authenticated demo users", () => {
  assert.deepEqual(realAnalyticsWhere.OR, [
    { userId: null },
    { user: { is: { isDemo: false } } }
  ]);
});
