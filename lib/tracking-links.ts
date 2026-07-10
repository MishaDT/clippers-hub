import { isPrivateAddress } from "./ip-guard.ts";

export function normalizeTrackingTarget(value: unknown) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || isPrivateAddress(host)) return null;
    url.hash = "";
    return url.toString().slice(0, 1000);
  } catch {
    return null;
  }
}
