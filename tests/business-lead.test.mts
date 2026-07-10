import assert from "node:assert/strict";
import test from "node:test";
import { businessLeadSchema } from "../lib/business-lead.ts";

const valid = {
  name: "Иван",
  contact: "ivan@example.com",
  contentUrl: "https://youtube.com/watch?v=test",
  budgetRub: 15_000,
  goal: "Нужно пять коротких роликов из подкаста",
  website: "",
  consent: true
};

test("pilot lead accepts a qualified contact", () => {
  assert.equal(businessLeadSchema.safeParse(valid).success, true);
});

test("pilot lead rejects low budgets and non-HTTPS links", () => {
  assert.equal(businessLeadSchema.safeParse({ ...valid, budgetRub: 14_999 }).success, false);
  assert.equal(businessLeadSchema.safeParse({ ...valid, contentUrl: "http://localhost/private" }).success, false);
});

test("pilot lead honeypot and consent fail closed", () => {
  assert.equal(businessLeadSchema.safeParse({ ...valid, website: "spam" }).success, false);
  assert.equal(businessLeadSchema.safeParse({ ...valid, consent: false }).success, false);
});
