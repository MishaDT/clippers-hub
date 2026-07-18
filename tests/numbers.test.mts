import assert from "node:assert/strict";
import test from "node:test";
import { boundedInteger, boundedNumber } from "../lib/numbers.ts";

test("boundedInteger rejects non-finite and malformed input", () => {
  assert.equal(boundedInteger("NaN", { min: 1, max: 20, fallback: 3 }), 3);
  assert.equal(boundedInteger(Infinity, { min: 1, max: 20, fallback: 3 }), 3);
  assert.equal(boundedInteger("oops", { min: 1, max: 20, fallback: 3 }), 3);
});

test("boundedInteger rounds and clamps", () => {
  assert.equal(boundedInteger("4.6", { min: 1, max: 20, fallback: 3 }), 5);
  assert.equal(boundedInteger(-100, { min: 1, max: 20, fallback: 3 }), 1);
  assert.equal(boundedInteger(999, { min: 1, max: 20, fallback: 3 }), 20);
});

test("boundedNumber preserves finite decimals and clamps", () => {
  assert.equal(boundedNumber("12.5", { min: 0, max: 25, fallback: 0 }), 12.5);
  assert.equal(boundedNumber("", { min: 0, max: 25, fallback: 7 }), 7);
  assert.equal(boundedNumber(40, { min: 0, max: 25, fallback: 0 }), 25);
});
