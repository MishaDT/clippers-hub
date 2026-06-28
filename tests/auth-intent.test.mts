import assert from "node:assert/strict";
import test from "node:test";
import { parseAuthIntent, safeAuthReturnTo } from "../lib/auth-intent.ts";

test("accepts only known role intents", () => {
  assert.equal(parseAuthIntent("client"), "client");
  assert.equal(parseAuthIntent("worker"), "worker");
  assert.equal(parseAuthIntent("admin"), null);
});

test("return path cannot redirect outside ReelPay", () => {
  assert.equal(safeAuthReturnTo("https://evil.example", "client"), "/campaigns/new");
  assert.equal(safeAuthReturnTo("//evil.example", "worker"), "/campaigns");
  assert.equal(safeAuthReturnTo("/campaigns/new", "client"), "/campaigns/new");
});
