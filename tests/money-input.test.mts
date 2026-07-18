import test from "node:test";
import assert from "node:assert/strict";
import { parseRubToCents } from "../lib/money.ts";

test("money input accepts ordinary ruble amounts", () => {
  assert.equal(parseRubToCents("15000"), 1_500_000);
  assert.equal(parseRubToCents("12,34"), 1_234);
});

test("money input rejects NaN, infinity, negative and overflowing values", () => {
  assert.equal(parseRubToCents("NaN"), 0);
  assert.equal(parseRubToCents("Infinity"), 0);
  assert.equal(parseRubToCents("-10"), 0);
  assert.equal(parseRubToCents("999999999999999"), 0);
});
