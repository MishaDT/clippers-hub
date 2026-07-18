import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const serverUrl = "http://127.0.0.1:3000/icon.svg";
const serverStatePath = resolve(process.cwd(), ".next", "e2e-server.json");

async function serverIsReady() {
  try {
    const response = await fetch(serverUrl, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (process.env.PLAYWRIGHT_BASE_URL || await serverIsReady()) return;

  const server = spawn(process.execPath, ["scripts/start-e2e-server.js"], {
    cwd: process.cwd(),
    env: process.env,
    detached: process.platform !== "win32",
    stdio: "ignore",
    windowsHide: true
  });

  if (!server.pid) throw new Error("E2E server failed to start.");
  server.unref();
  mkdirSync(resolve(process.cwd(), ".next"), { recursive: true });
  writeFileSync(serverStatePath, JSON.stringify({ pid: server.pid, startedAt: Date.now() }));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await serverIsReady()) return;
    if (server.exitCode !== null) throw new Error(`E2E server exited with code ${server.exitCode}.`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("E2E server did not become ready within 60 seconds.");
}

export default async function globalSetup() {
  if (process.env.E2E_SKIP_SETUP !== "1") {
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
  await startServer();
}
