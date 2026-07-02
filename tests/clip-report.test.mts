import assert from "node:assert/strict";
import test from "node:test";
import { explainSubmission } from "../lib/clip-report.ts";

const base = {
  status: "VERIFIED",
  fraudScore: 20,
  currentViews: 3000,
  viewThreshold: 10000,
  platform: "YOUTUBE",
  videoChecks: [] as { checkType: string; status: string }[],
  disputeOpen: false
};

const states = (r: ReturnType<typeof explainSubmission>) =>
  Object.fromEntries(r.reasons.map((x) => [x.label, x.state]));

test("clean in-progress submission reads as pending, not blocked", () => {
  const r = explainSubmission(base);
  assert.equal(r.tone, "pending");
  assert.equal(states(r)["Проверка на накрутку"], "ok");
  assert.equal(states(r)["Цель по просмотрам"], "pending");
});

test("passed ownership + reached goal reads good", () => {
  const r = explainSubmission({
    ...base, status: "THRESHOLD_MET", currentViews: 12000,
    videoChecks: [{ checkType: "OWNERSHIP", status: "PASS" }]
  });
  assert.equal(r.tone, "good");
  assert.equal(states(r)["Владение"], "ok");
  assert.equal(states(r)["Цель по просмотрам"], "ok");
});

test("high fraud rejected reads bad and explains why", () => {
  const r = explainSubmission({ ...base, status: "REJECTED", fraudScore: 82 });
  assert.equal(r.tone, "bad");
  assert.equal(states(r)["Проверка на накрутку"], "bad");
});

test("failed ownership is a blocking reason", () => {
  const r = explainSubmission({ ...base, videoChecks: [{ checkType: "OWNERSHIP", status: "FAIL" }] });
  assert.equal(states(r)["Владение"], "bad");
});

test("open dispute pauses regardless of status", () => {
  const r = explainSubmission({ ...base, status: "SETTLING", disputeOpen: true });
  assert.equal(r.tone, "warn");
  assert.ok(r.reasons.some((x) => x.label === "Спор"));
});

test("tracking label is honest per platform", () => {
  assert.match(explainSubmission({ ...base, platform: "YOUTUBE" }).tracking, /Авто-проверка/);
  assert.match(explainSubmission({ ...base, platform: "TIKTOK" }).tracking, /Ручная проверка/);
  // TikTok pending ownership mentions manual moderator, not auto code check
  const tt = explainSubmission({ ...base, platform: "TIKTOK" });
  assert.match(tt.reasons.find((x) => x.label === "Владение")!.text, /ручное/);
});
