import assert from "node:assert/strict";
import test from "node:test";
import {
  ACHIEVEMENTS,
  achievementProgress,
  nextFeaturedUntil,
  RP_BOOST_COST
} from "../lib/achievements.ts";
import { moscowWeekKey, splitRpSpend, WEEKLY_RP_CAP } from "../lib/rp.ts";

const emptyStats = {
  approvedClips: 0,
  totalClips: 0,
  weekViews: 0,
  bestClipViews: 0,
  streakDays: 0,
  referrals: 0,
  campaigns: 0,
  clipsReceived: 0
  ,completedOrders: 0
};

test("achievement unlocks exactly at its target", () => {
  const first = ACHIEVEMENTS.find((item) => item.code === "FIRST_CLIP")!;
  assert.equal(achievementProgress(first, emptyStats).done, false);
  assert.equal(achievementProgress(first, { ...emptyStats, approvedClips: 1 }).done, true);
});

test("catalogue has stable RP rewards", () => {
  assert.equal(ACHIEVEMENTS.length, 9);
  assert.equal(ACHIEVEMENTS.find((item) => item.code === "MILLION_CLUB")?.reward, 300);
  assert.equal(RP_BOOST_COST, 100);
});

test("RP spending uses bonus before purchased balance", () => {
  assert.deepEqual(splitRpSpend(150, 80, 100), { bonusUsed: 70, purchasedUsed: 30 });
  assert.equal(WEEKLY_RP_CAP, 120);
});

test("Moscow reward period starts on Monday", () => {
  assert.equal(moscowWeekKey(new Date("2026-06-28T20:00:00Z")), "2026-06-22");
  assert.equal(moscowWeekKey(new Date("2026-06-29T10:00:00Z")), "2026-06-29");
});

test("promotion extends from the existing deadline", () => {
  const now = new Date("2026-06-28T12:00:00Z");
  const current = new Date("2026-06-30T12:00:00Z");
  assert.equal(nextFeaturedUntil(current, now)?.toISOString(), "2026-07-01T12:00:00.000Z");
});

test("promotion cannot exceed seven days", () => {
  const now = new Date("2026-06-28T12:00:00Z");
  const current = new Date("2026-07-05T12:00:00Z");
  assert.equal(nextFeaturedUntil(current, now), null);
});
