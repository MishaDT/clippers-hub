import assert from "node:assert/strict";
import test from "node:test";
import { campaignMatch } from "../lib/campaign-matching.ts";

const deadline = new Date(Date.now() + 5 * 86_400_000);

test("specialty and verified history improve a match", () => {
  const result = campaignMatch(
    { niche: "Gaming", sourcePlatform: "TWITCH", deadline },
    { specialties: ["Игры"], completedNiches: ["Gaming"], completedPlatforms: ["TWITCH"], trustScore: 95 }
  );
  assert.equal(result.score, 100);
  assert.match(result.reasons.join(" "), /специализац/);
});

test("urgent work is ranked lower", () => {
  const result = campaignMatch(
    { niche: "Finance", sourcePlatform: "YOUTUBE", deadline: new Date(Date.now() + 6 * 3_600_000) },
    { specialties: [], completedNiches: [], completedPlatforms: [], trustScore: 100 }
  );
  assert.equal(result.score, 15);
});

test("new workers get an honest profile hint", () => {
  const result = campaignMatch(
    { niche: "Sport", sourcePlatform: "TIKTOK", deadline },
    { specialties: [], completedNiches: [], completedPlatforms: [], trustScore: 100 }
  );
  assert.ok(result.reasons.some((reason) => reason.includes("Заполните")));
});
