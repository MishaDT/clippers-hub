import assert from "node:assert/strict";
import test from "node:test";
import { scanContent } from "../lib/content-policy.ts";

test("blocks explicit illegal sales", () => {
  assert.equal(scanContent("Продам наркотики с доставкой").action, "BLOCK");
  assert.equal(scanContent("купить оружие и боеприпасы").action, "BLOCK");
});

test("flags gambling for review", () => {
  assert.equal(scanContent("Реклама онлайн казино и слотов").action, "REVIEW");
});

test("support reports are delivered for review", () => {
  assert.equal(scanContent("Сообщаю: пользователь продаёт наркотики", "SUPPORT").action, "REVIEW");
});

test("allows ordinary production discussion", () => {
  assert.equal(scanContent("Нужны субтитры и сильный первый кадр").action, "ALLOW");
});
