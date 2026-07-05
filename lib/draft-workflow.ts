export type DraftDecisionInput = {
  reviewMode: "FAST" | "STANDARD" | "STRICT";
  trustScore: number;
};

export function initialDraftDecision({ reviewMode, trustScore }: DraftDecisionInput) {
  return reviewMode === "FAST" && trustScore >= 90 ? "APPROVED" as const : "PENDING" as const;
}

export function nextDraftRevision(
  status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  currentRevision: number,
  maxRevisionRounds: number
) {
  if (!["NOT_SUBMITTED", "CHANGES_REQUESTED"].includes(status)) return null;
  const next = status === "CHANGES_REQUESTED" ? currentRevision + 1 : currentRevision;
  return next <= maxRevisionRounds ? next : null;
}

export function validateDraftUrl(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const privateHost =
      host === "localhost"
      || host.endsWith(".localhost")
      || host === "127.0.0.1"
      || host === "::1"
      || host === "0.0.0.0"
      || /^10\./.test(host)
      || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      || /^169\.254\./.test(host);
    if (url.protocol !== "https:" || url.username || url.password || privateHost) return null;
    return url.toString().slice(0, 700);
  } catch {
    return null;
  }
}
