// Backwards-compatible adapter over the risk-scoring safety engine (lib/safety). Existing
// callers keep using scanContent()/PolicyDecision; the actual detection now comes from the
// normalizer + dictionaries + detectors + scoring in lib/safety.
import { evaluate, type SafetyContext } from "./safety/engine.ts";

export type PolicyDecision = {
  action: "ALLOW" | "FLAG" | "REVIEW" | "BLOCK";
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  matches: string[];
};

const ACTION_MAP = { allow: "ALLOW", flag: "FLAG", review: "REVIEW", block: "BLOCK" } as const;
const SOFT_FLAGS = new Set(["PROFANITY", "INSULT", "MESSENGER_NAME", "EXTERNAL_URL"]);

export function scanContent(value: string, context: SafetyContext = "PUBLIC"): PolicyDecision {
  const result = evaluate(value, context);
  const action = ACTION_MAP[result.action];
  let severity: PolicyDecision["severity"];
  if (action === "BLOCK") severity = "CRITICAL";
  else if (action === "REVIEW") severity = "HIGH";
  else if (action === "FLAG") severity = result.flags.every((flag) => SOFT_FLAGS.has(flag)) ? "LOW" : "MEDIUM";
  else severity = "LOW";
  return {
    action,
    category: result.flags[0] || "NONE",
    severity,
    matches: result.reasons.slice(0, 5)
  };
}

// Full result (riskScore, all flags, role-aware, optional URL reputation) for callers that
// want more than the legacy decision shape.
export { checkMessagePolicy, evaluate } from "./safety/engine.ts";
export type { PolicyResult, SafetyContext, SafetyRole, SafetyAction } from "./safety/engine.ts";
