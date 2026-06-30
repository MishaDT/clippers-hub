import assert from "node:assert/strict";
import test from "node:test";
import { normalizeText } from "../lib/safety/normalizer.ts";
import {
  detectProfanity, detectDealLeak, detectContacts
} from "../lib/safety/detectors.ts";

const codes = (hits: { code: string }[]) => hits.map((h) => h.code);
const n = (s: string) => normalizeText(s);

test("profanity caught through spacing, leet and homoglyphs", () => {
  assert.ok(detectProfanity(n("ты х у й")).length);
  assert.ok(detectProfanity(n("п1зда полная")).length);
  assert.ok(detectProfanity(n("xyйло")).length);
  assert.ok(detectProfanity(n("за.е.б.а.л")).length);
});

test("clean words containing a profanity substring are not flagged", () => {
  for (const w of ["хлеб", "требования", "себе", "страховка", "директор", "команда", "блестит"]) {
    assert.equal(detectProfanity(n(w)).length, 0, w);
  }
});

test("phone numbers are detected, plain large numbers are not", () => {
  assert.ok(codes(detectContacts("звони +7 999 123 45 67", n("звони +7 999 123 45 67"))).includes("CONTACT_PHONE"));
  assert.equal(codes(detectContacts("ролик набрал 1 000 000 просмотров", n("ролик набрал 1 000 000 просмотров"))).includes("CONTACT_PHONE"), false);
});

test("telegram handle, telegram link and email are detected", () => {
  assert.ok(codes(detectContacts("мой ник @cooluser", n("мой ник @cooluser"))).includes("TELEGRAM_HANDLE"));
  assert.ok(codes(detectContacts("https://t.me/cooluser", n("https://t.me/cooluser"))).includes("TELEGRAM_LINK"));
  assert.ok(codes(detectContacts("пишите user@example.com", n("пишите user@example.com"))).includes("EMAIL"));
});

test("messenger + solicitation verb upgrades to a solicit signal", () => {
  assert.ok(codes(detectContacts("пиши в телеграм", n("пиши в телеграм"))).includes("CONTACT_SOLICIT"));
  assert.ok(codes(detectContacts("у площадки есть телеграм канал", n("у площадки есть телеграм канал"))).includes("MESSENGER_NAME"));
});

test("deal-leak phrases are detected", () => {
  assert.ok(detectDealLeak(n("давай оплата напрямую")).length);
  assert.ok(detectDealLeak(n("сделаем без сайта")).length);
  assert.ok(detectDealLeak(n("переведи на карту")).length);
});
