import assert from "node:assert/strict";
import test from "node:test";
import { workerMatch } from "../lib/worker-matching.ts";

const campaign = {
  niche: "Gaming",
  sourcePlatform: "TWITCH",
  deadline: new Date(Date.now() + 5 * 86_400_000),
  reviewMode: "STANDARD",
  viewThreshold: 10_000
};

test("relevant verified worker is ranked highly", () => {
  const result = workerMatch(campaign, {
    specialties: ["Игры"],
    completedNiches: ["Gaming"],
    completedPlatforms: ["TWITCH"],
    trustScore: 96,
    verified: true,
    averageViews: 25_000,
    activeOrders: 1
  });
  assert.equal(result.score, 100);
  assert.ok(result.reasons.includes("Подходит специализация"));
});

test("overloaded worker is ranked lower", () => {
  const base = {
    specialties: ["Игры"],
    completedNiches: [],
    completedPlatforms: [],
    trustScore: 90,
    verified: false,
    averageViews: 4_000
  };
  const free = workerMatch(campaign, { ...base, activeOrders: 0 });
  const busy = workerMatch(campaign, { ...base, activeOrders: 4 });
  assert.ok(free.score > busy.score);
});

test("urgent strict campaign does not overrate an untrusted worker", () => {
  const result = workerMatch(
    { ...campaign, deadline: new Date(Date.now() + 6 * 3_600_000), reviewMode: "FAST" },
    {
      specialties: [],
      completedNiches: [],
      completedPlatforms: [],
      trustScore: 60,
      verified: false,
      averageViews: 0,
      activeOrders: 2
    }
  );
  assert.ok(result.score < 20);
});
