import { execFileSync } from "node:child_process";

export default async function globalSetup() {
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
  execFileSync("node", ["prisma/seed.js"], { stdio: "inherit", env: process.env });
}
