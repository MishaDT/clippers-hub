import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const serverStatePath = resolve(process.cwd(), ".next", "e2e-server.json");

export default async function globalTeardown() {
  let pid: number | undefined;
  try {
    const state = JSON.parse(readFileSync(serverStatePath, "utf8")) as { pid?: number };
    pid = state.pid;
  } catch {
    return;
  }

  try {
    if (typeof pid === "number" && Number.isInteger(pid) && pid > 0) {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        process.kill(-pid, "SIGKILL");
      }
    }
  } catch {
    // The process may already be stopped; teardown should still finish.
  } finally {
    try {
      unlinkSync(serverStatePath);
    } catch {
      // Nothing to clean up.
    }
  }
}
