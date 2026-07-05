import assert from "node:assert/strict";
import test from "node:test";
import { adminTransactionTransition } from "../lib/transaction-rules.ts";

test("failed withdrawal returns the previously debited balance", () => {
  assert.deepEqual(
    adminTransactionTransition({ type: "WITHDRAWAL", currentStatus: "PENDING", nextStatus: "FAILED" }),
    { nextStatus: "FAILED", refundBalance: true }
  );
});

test("completed withdrawal remains debited", () => {
  assert.deepEqual(
    adminTransactionTransition({ type: "WITHDRAWAL", currentStatus: "PENDING", nextStatus: "COMPLETED" }),
    { nextStatus: "COMPLETED", refundBalance: false }
  );
});

test("terminal and internal transactions cannot be manually rewritten", () => {
  assert.equal(adminTransactionTransition({ type: "WITHDRAWAL", currentStatus: "FAILED", nextStatus: "COMPLETED" }), null);
  assert.equal(adminTransactionTransition({ type: "EARNING", currentStatus: "PENDING", nextStatus: "COMPLETED" }), null);
  assert.equal(adminTransactionTransition({ type: "DEPOSIT", currentStatus: "PENDING", nextStatus: "COMPLETED" }), null);
});
