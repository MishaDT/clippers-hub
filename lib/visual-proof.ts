import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function visualProofSecret() {
  const value = process.env.VISUAL_PROOF_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("VISUAL_PROOF_SECRET must be configured with at least 32 characters");
  return value;
}

export function visualProofToken(submissionId: string, trackingCode: string) {
  const payload = `${submissionId}.${trackingCode}`;
  const signature = createHmac("sha256", visualProofSecret()).update(payload).digest("base64url").slice(0, 22);
  return `RPV1.${submissionId}.${signature}`;
}

export function visualProofTokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function visualProofMatches(token: string, expectedHash: string | null | undefined) {
  if (!expectedHash) return false;
  const actual = Buffer.from(visualProofTokenHash(token));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
