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

test("flags off-platform contact attempts in chat (does not block)", () => {
  assert.equal(scanContent("давай в телеграм обсудим", "CHAT").action, "FLAG");
  assert.equal(scanContent("пиши мне в вотсап", "CHAT").action, "FLAG");
  assert.equal(scanContent("мой тг @cooluser123", "CHAT").action, "FLAG");
  assert.equal(scanContent("почта me.user@gmail.com", "CHAT").action, "FLAG");
  assert.equal(scanContent("звони +7 999 123 45 67", "CHAT").action, "FLAG");
});

test("contact info is allowed inside support (legit to share with staff)", () => {
  assert.equal(scanContent("мой телефон +7 999 123 45 67", "SUPPORT").action, "ALLOW");
  assert.equal(scanContent("пишите на mail user@example.com", "SUPPORT").action, "ALLOW");
});

test("flags profanity without blocking", () => {
  const d = scanContent("ты бля что творишь", "CHAT");
  assert.equal(d.action, "FLAG");
  assert.equal(d.category, "PROFANITY");
});

test("hard-illegal still outranks the new flag tiers", () => {
  // contains a phone number too, but illegal sale wins and blocks
  assert.equal(scanContent("продам наркотики, пиши +7 999 123 45 67", "CHAT").action, "BLOCK");
});

test("clean message with numbers is not mistaken for a phone", () => {
  assert.equal(scanContent("ролик набрал 1 000 просмотров за час", "CHAT").action, "ALLOW");
});
