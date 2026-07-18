import { readTextWithLimit } from "../../request-json.ts";

// External URL-reputation providers (URLhaus / PhishTank). Deliberately INACTIVE until the
// relevant API key is configured: with no env set, checkUrlReputation makes zero network
// calls and returns "not malicious", so it adds no latency and never blocks messages by
// default. When enabled it is cached, time-boxed, and fail-open (a provider error or timeout
// never turns an allowed message into a blocked one).
//
// ENV:
//   URLHAUS_AUTH_KEY   – abuse.ch URLhaus Auth-Key (https://urlhaus.abuse.ch/api/)
//   PHISHTANK_API_KEY  – PhishTank application key (https://www.phishtank.com/api_info.php)
// Spamhaus DBL is DNS-based (DNSBL) and not implemented here; add a DNS lookup if needed.

type RepResult = { malicious: boolean; code: string; sample: string };

const CLEAN: RepResult = { malicious: false, code: "", sample: "" };
const cache = new Map<string, { value: RepResult; expires: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;

function enabled() {
  return Boolean(process.env.URLHAUS_AUTH_KEY || process.env.PHISHTANK_API_KEY);
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await p(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function urlhaus(url: string): Promise<RepResult | null> {
  const key = process.env.URLHAUS_AUTH_KEY;
  if (!key) return null;
  const res = await withTimeout(
    (signal) =>
      fetch("https://urlhaus-api.abuse.ch/v1/url/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Auth-Key": key },
        body: new URLSearchParams({ url }),
        signal,
        cache: "no-store"
      }),
    1500
  );
  if (!res.ok) return null;
  const data = JSON.parse(await readTextWithLimit(res, 256_000));
  if (data?.query_status === "ok" && (data.threat || data.url_status === "online")) {
    return { malicious: true, code: "MALWARE_URL", sample: url.slice(0, 80) };
  }
  return CLEAN;
}

async function phishtank(url: string): Promise<RepResult | null> {
  const key = process.env.PHISHTANK_API_KEY;
  if (!key) return null;
  const res = await withTimeout(
    (signal) =>
      fetch("https://checkurl.phishtank.com/checkurl/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "phishtank/reelpay" },
        body: new URLSearchParams({ url, format: "json", app_key: key }),
        signal,
        cache: "no-store"
      }),
    1500
  );
  if (!res.ok) return null;
  const data = JSON.parse(await readTextWithLimit(res, 256_000));
  if (data?.results?.in_database && data.results.valid) {
    return { malicious: true, code: "PHISHING_URL", sample: url.slice(0, 80) };
  }
  return CLEAN;
}

async function checkOne(url: string): Promise<RepResult> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value;

  let value: RepResult = CLEAN;
  for (const provider of [urlhaus, phishtank]) {
    try {
      const r = await provider(url);
      if (r?.malicious) {
        value = r;
        break;
      }
    } catch {
      // fail-open per provider
    }
  }
  cache.set(url, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function checkUrlReputation(text: string): Promise<RepResult> {
  if (!enabled()) return CLEAN;
  const urls = Array.from(new Set(text.match(URL_RE) || [])).slice(0, 3);
  for (const url of urls) {
    const r = await checkOne(url);
    if (r.malicious) return r;
  }
  return CLEAN;
}
