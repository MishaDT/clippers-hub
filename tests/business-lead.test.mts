import assert from "node:assert/strict";
import test from "node:test";

import { businessLeadSchema } from "../lib/business-lead.ts";

const base = {
  name: "Тестовый заказчик",
  contact: "test@example.com",
  budgetRub: 15_000,
  goal: "Подготовить короткие ролики",
  consent: true as const
};

test("business lead accepts a public HTTPS content URL", () => {
  assert.equal(businessLeadSchema.safeParse({ ...base, contentUrl: "https://youtube.com/watch?v=abc" }).success, true);
});

test("business lead rejects local, credentialed and non-HTTPS links", () => {
  for (const contentUrl of [
    "http://example.com/video",
    "https://localhost/admin",
    "https://127.0.0.1/private",
    "https://user:password@example.com/video"
  ]) {
    assert.equal(businessLeadSchema.safeParse({ ...base, contentUrl }).success, false, contentUrl);
  }
});
