const PRIVATE_KEY = /(email|phone|address|password|secret|token|cookie|full.?name)/i;
const EMAIL_VALUE = /\b[^@\s]+@[^@\s]+\.[^@\s]+\b/;
const PHONE_VALUE = /(?:\+?\d[\s().-]*){8,}/;
const URL_VALUE = /https?:\/\//i;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (EMAIL_VALUE.test(value) || PHONE_VALUE.test(value) || URL_VALUE.test(value)) return "[redacted]";
    return value.slice(0, 160);
  }
  if (depth >= 2) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, item]) => [key.slice(0, 60), PRIVATE_KEY.test(key) ? "[redacted]" : sanitizeValue(item, depth + 1)])
    );
  }
  return null;
}

export function sanitizeAnalyticsMetadata(metadata?: Record<string, unknown>) {
  return metadata ? sanitizeValue(metadata, 0) as Record<string, unknown> : {};
}
