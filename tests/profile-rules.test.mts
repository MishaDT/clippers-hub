import assert from "node:assert/strict";
import test from "node:test";
import {
  canChangeHandle,
  isPortfolioEligible,
  parseSocialLinks,
  parseSpecialties,
  validateHandle
} from "../lib/profile-rules.ts";

test("handle accepts only 3-24 latin characters, digits and underscore", () => {
  assert.equal(validateHandle("anya_clips").ok, true);
  assert.equal(validateHandle("Аня").ok, false);
  assert.equal(validateHandle("ab").ok, false);
});

test("handle cooldown lasts 30 days", () => {
  const now = new Date("2026-06-28T00:00:00Z");
  assert.equal(canChangeHandle(new Date("2026-06-01T00:00:00Z"), now), false);
  assert.equal(canChangeHandle(new Date("2026-05-28T00:00:00Z"), now), true);
});

test("profile collections are allowlisted and limited", () => {
  assert.deepEqual(parseSpecialties(["Игры", "Игры", "Спам"]), ["Игры"]);
  assert.equal(parseSocialLinks("https://youtube.com/@a\nhttps://evil.example/a").length, 1);
});

test("portfolio accepts only verified completed work", () => {
  assert.equal(isPortfolioEligible("VERIFIED", new Date()), true);
  assert.equal(isPortfolioEligible("POSTED", new Date()), false);
  assert.equal(isPortfolioEligible("VERIFIED", null), false);
});
