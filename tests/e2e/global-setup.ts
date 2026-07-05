import { execFileSync } from "node:child_process";

export default async function globalSetup() {
  if (process.env.E2E_SKIP_SETUP === "1") return;
  const testUrl = process.env.DATABASE_URL;
  if (!testUrl) throw new Error("E2E requires DATABASE_URL_TEST.");
  const parsed = new URL(testUrl);
  if (parsed.searchParams.get("schema") !== "reelpay_e2e") {
    throw new Error("E2E is blocked: DATABASE_URL must use the reelpay_e2e schema.");
  }
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--force-reset"], {
    stdio: "inherit",
    env: process.env
  });
  execFileSync(process.execPath, ["scripts/seed-e2e.js"], { stdio: "inherit", env: process.env });
}
