import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function testDatabaseUrl() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_TEST is required for E2E.");
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("schema", "reelpay_e2e");
  return url.toString();
}

const e2eDatabaseUrl = testDatabaseUrl();
process.env.DATABASE_URL = e2eDatabaseUrl;
process.env.DIRECT_URL = e2eDatabaseUrl;
process.env.E2E_TEST = "1";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 950 } } },
    { name: "mobile", use: { ...devices["Pixel 5"], browserName: "chromium" } }
  ]
});
