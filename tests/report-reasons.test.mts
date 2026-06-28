import assert from "node:assert/strict";
import test from "node:test";
import { isSafeRussianReport, normalizeRussianReport, reportReasonLabel } from "../lib/report-reasons.ts";

test("report category must come from the allowlist", () => {
  assert.equal(reportReasonLabel("FRAUD"), "Мошенничество");
  assert.equal(reportReasonLabel("DROP TABLE"), null);
});

test("custom report accepts short Russian text only", () => {
  assert.equal(isSafeRussianReport("Пользователь выдаёт себя за другого автора."), true);
  assert.equal(isSafeRussianReport("open https://evil.example now"), false);
  assert.equal(isSafeRussianReport("<script>alert(1)</script>"), false);
});

test("custom report is normalized and limited", () => {
  assert.equal(normalizeRussianReport("  Это\u200B   спам  "), "Это спам");
  assert.equal(isSafeRussianReport(Array.from({ length: 36 }, () => "слово").join(" ")), false);
});
