import assert from "node:assert/strict";
import test from "node:test";
import { normalizeText } from "../lib/safety/normalizer.ts";

test("leet digits and @ become Cyrillic in deob", () => {
  assert.ok(normalizeText("п1зда").deob.includes("пизда"));
  assert.ok(normalizeText("сук@").deob.includes("сука"));
  assert.ok(normalizeText("3алупа").deob.includes("залупа"));
});

test("Latin homoglyphs map to Cyrillic in deob", () => {
  assert.ok(normalizeText("xyй").deob.includes("хуй"));
  assert.ok(normalizeText("cyка").deob.includes("сука"));
});

test("repeated characters collapse in deob", () => {
  assert.ok(normalizeText("хуууй").deob.includes("хуй"));
  assert.ok(normalizeText("блллля").deob.includes("бля"));
});

test("ё is normalized to е and case is lowered", () => {
  assert.ok(normalizeText("ЁЛКА").text.includes("елка"));
});
