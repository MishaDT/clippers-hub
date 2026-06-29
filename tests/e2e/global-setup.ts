import { execFileSync } from "node:child_process";

export default async function globalSetup() {
  const testUrl = process.env.DATABASE_URL;
  if (!testUrl) throw new Error("E2E requires DATABASE_URL_TEST.");
  const parsed = new URL(testUrl);
  if (parsed.searchParams.get("schema") !== "reelpay_e2e") {
    throw new Error("E2E is blocked: DATABASE_URL must use the reelpay_e2e schema.");
  }
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  execFileSync("node", ["prisma/seed.js"], { stdio: "inherit", env: process.env });
}
