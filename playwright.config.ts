import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "powershell -NoProfile -ExecutionPolicy Bypass -File .\\node_modules\\.bin\\next.ps1 dev --hostname 127.0.0.1 --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 950 } } },
    { name: "mobile", use: { ...devices["Pixel 5"], browserName: "chromium" } }
  ]
});
