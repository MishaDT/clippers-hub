type BoundedNumberOptions = {
  min: number;
  max: number;
  fallback: number;
};

/** Converts untrusted input to a finite integer within an explicit safe range. */
export function boundedInteger(value: unknown, options: BoundedNumberOptions) {
  const normalized = typeof value === "number" ? value : String(value ?? "").trim();
  if (normalized === "") return options.fallback;
  const parsed = typeof normalized === "number" ? normalized : Number(normalized);
  if (!Number.isFinite(parsed)) return options.fallback;
  return Math.min(options.max, Math.max(options.min, Math.round(parsed)));
}

/** Converts untrusted input to a finite decimal within an explicit safe range. */
export function boundedNumber(value: unknown, options: BoundedNumberOptions) {
  const normalized = typeof value === "number" ? value : String(value ?? "").trim();
  if (normalized === "") return options.fallback;
  const parsed = typeof normalized === "number" ? normalized : Number(normalized);
  if (!Number.isFinite(parsed)) return options.fallback;
  return Math.min(options.max, Math.max(options.min, parsed));
}
