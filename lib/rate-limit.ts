import "server-only";

const buckets = new Map<string, { count: number; reset: number }>();

// Best-effort in-memory limiter. On serverless it is per-instance and resets on cold
// start, so it's a basic guard — for hard guarantees use Upstash/Redis.
export function rateLimit(key: string, limit = 8, windowMs = 60_000) {
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

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "").trim();
  return ip || "unknown";
}
