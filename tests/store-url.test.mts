import assert from "node:assert/strict";
import test from "node:test";
import { safeHttpsUrl } from "../lib/safe-https-url.ts";

test("store links accept public HTTPS URLs", () => {
  assert.equal(safeHttpsUrl("https://bank.example/product?a=1"), "https://bank.example/product?a=1");
});

test("store links reject credentials and internal destinations", () => {
  assert.equal(safeHttpsUrl("https://user:pass@bank.example/product"), null);
  assert.equal(safeHttpsUrl("https://localhost/admin"), null);
  assert.equal(safeHttpsUrl("https://127.0.0.1/admin"), null);
  assert.equal(safeHttpsUrl("http://bank.example/product"), null);
});
