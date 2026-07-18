import "server-only";
import { readTextWithLimit } from "@/lib/request-json";

const buckets = new Map<string, { count: number; reset: number }>();

// Per-instance fallback. On serverless this is per-instance and resets on cold start, so on
// its own it's only a basic guard — Upstash (below) gives the shared, hard limit.
function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

// Shared fixed-window limiter backed by Upstash Redis when configured (counts across every
// serverless instance, so it can't be bypassed by scaling out or cold starts). Falls back to
// the in-memory limiter when Upstash isn't configured or is unreachable — never fails closed
// on auth just because Redis blipped.
export async function rateLimit(key: string, limit = 8, windowMs = 60_000) {
  const cfg = upstashConfig();
  if (!cfg) return memoryLimit(key, limit, windowMs);

  const redisKey = `rl:${key}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    // INCR the counter, then set the TTL only on the first hit of the window (EXPIRE ... NX).
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSec), "NX"]
      ]),
      signal: controller.signal,
      cache: "no-store"
    });
    if (!res.ok) return memoryLimit(key, limit, windowMs);
    const data = JSON.parse(await readTextWithLimit(res, 64_000)) as Array<{ result?: unknown }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) return memoryLimit(key, limit, windowMs);
    return count <= limit;
  } catch {
    return memoryLimit(key, limit, windowMs);
  } finally {
    clearTimeout(timer);
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "").trim();
  return ip || "unknown";
}
