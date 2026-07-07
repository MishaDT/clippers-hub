// k6 load test — simulates up to 1000 concurrent visitors on ReelPay's public read paths.
// This is the honest way to answer "can 1000 people use the site right now": run it against
// the REAL deployed URL (only prod has the database and serverless infra).
//
// Install k6: https://k6.io/docs/get-started/installation/  (Windows: `winget install k6`)
// Run:
//   k6 run -e BASE_URL=https://ВАШ-ПРОД-URL scripts/loadtest.js
// Softer first pass (200 users):
//   k6 run -e BASE_URL=https://ВАШ-ПРОД-URL -e PEAK=200 scripts/loadtest.js

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const PEAK = Number(__ENV.PEAK || 1000);

const errors = new Rate("business_errors");

export const options = {
  // Ramp up, hold the peak for 2 minutes, ramp down. The hold is where you see if the
  // database connection pool / serverless concurrency actually survives sustained load.
  stages: [
    { duration: "30s", target: Math.round(PEAK * 0.2) },
    { duration: "1m", target: PEAK },
    { duration: "2m", target: PEAK },
    { duration: "30s", target: 0 }
  ],
  thresholds: {
    // Pass criteria — tune to your expectations:
    http_req_failed: ["rate<0.01"], // <1% failed requests
    http_req_duration: ["p(95)<1500"], // 95% of requests under 1.5s
    business_errors: ["rate<0.01"]
  }
};

// Guest-readable pages only (no auth). /campaigns is the heaviest read (marketplace query,
// cached ~30s) — the best stress target. Add a real campaign id to CAMPAIGN_ID to also hit
// the detail page.
const paths = [
  "/",
  "/campaigns",
  "/business",
  "/leaderboard",
  "/safety/views",
  "/sitemap.xml"
];

export default function () {
  group("browse", () => {
    const path = paths[Math.floor(Math.random() * paths.length)];
    const res = http.get(`${BASE}${path}`, { tags: { path } });
    const ok = check(res, {
      "status is 200": (r) => r.status === 200,
      "not a 5xx": (r) => r.status < 500
    });
    errors.add(!ok);
  });
  // Think time between page views so the load looks like real humans, not a tight loop.
  sleep(Math.random() * 2 + 1);
}
