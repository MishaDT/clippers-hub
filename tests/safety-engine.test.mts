import assert from "node:assert/strict";
import test from "node:test";
import { evaluate, checkMessagePolicy } from "../lib/safety/engine.ts";

test("risk tiers map to actions", () => {
  assert.equal(evaluate("нужны субтитры и динамичный монтаж", "CHAT").action, "allow");
  assert.equal(evaluate("ты х у й", "CHAT").action, "flag");          // profanity → flag
  assert.equal(evaluate("пиши в телеграм", "CHAT").action, "review"); // solicit → review
  assert.equal(evaluate("оплата напрямую без сайта", "CHAT").action, "block"); // deal-leak → block
});

test("hard-illegal blocks in chat but is reviewed in support", () => {
  assert.equal(evaluate("продам наркотики с доставкой", "CHAT").action, "block");
  assert.equal(evaluate("продам наркотики с доставкой", "SUPPORT").action, "review");
});

test("contact info is allowed in support context", () => {
  assert.equal(evaluate("мой номер +7 999 123 45 67", "SUPPORT").action, "allow");
});

test("multiple contact signals push the score to block", () => {
  const r = evaluate("пиши в телеграм @cooluser и звони +7 999 123 45 67", "CHAT");
  assert.ok(r.riskScore >= 80);
  assert.equal(r.action, "block");
});

test("checkMessagePolicy returns the full shape and is role-aware", async () => {
  const user = await checkMessagePolicy({ text: "оплата напрямую без сайта", context: "CHAT", role: "user" });
  assert.equal(user.action, "block");
  assert.equal(user.allowed, false);
  assert.equal(typeof user.riskScore, "number");
  assert.ok(user.reasons.length >= 1);

  const admin = await checkMessagePolicy({ text: "оплата напрямую без сайта", context: "CHAT", role: "admin" });
  assert.notEqual(admin.action, "block");
  assert.equal(admin.allowed, true);
  assert.ok(admin.flags.includes("DEAL_LEAK")); // still recorded
});

test("clean text yields zero score and no flags", () => {
  const r = evaluate("обсудим правки по ролику завтра", "CHAT");
  assert.equal(r.riskScore, 0);
  assert.equal(r.flags.length, 0);
});
