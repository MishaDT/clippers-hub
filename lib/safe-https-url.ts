import { isIP } from "node:net";
import { isPrivateAddress } from "./ip-guard.ts";

export function safeHttpsUrl(value: unknown) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || host === "localhost"
      || host.endsWith(".localhost")
      || host.endsWith(".local")
      || (isIP(host) && isPrivateAddress(host))
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}
