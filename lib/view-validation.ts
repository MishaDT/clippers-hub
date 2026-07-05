export const VIEW_RISK_REVIEW_THRESHOLD = 70;

export type ViewRiskReason =
  | "provider_views_decreased"
  | "explosive_growth"
  | "very_low_engagement"
  | "zero_engagement"
  | "ownership_missing";

export type ViewRiskInput = {
  previousViews: number;
  observedViews: number;
  views: number;
  likes: number;
  comments: number;
  elapsedSeconds: number;
  ownershipVerified: boolean;
};

export type ViewRiskResult = {
  fraudScore: number;
  requiresReview: boolean;
  reasons: ViewRiskReason[];
};

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/**
 * Deterministic screening for obvious metric anomalies.
 *
 * This is a risk signal, not proof of manipulation. A score at or above the
 * review threshold freezes settlement until a moderator decides the case.
 */
export function evaluateViewRisk(input: ViewRiskInput): ViewRiskResult {
  const previousViews = safeCount(input.previousViews);
  const observedViews = safeCount(input.observedViews);
  const views = safeCount(input.views);
  const likes = safeCount(input.likes);
  const comments = safeCount(input.comments);
  const elapsedSeconds = Math.max(1, safeCount(input.elapsedSeconds));
  const delta = Math.max(0, views - previousViews);
  const reasons: ViewRiskReason[] = [];
  let score = 5;

  if (observedViews < previousViews) {
    score += 30;
    reasons.push("provider_views_decreased");
  }

  const viewsPerMinute = delta / Math.max(1, elapsedSeconds / 60);
  if (delta >= 100_000 && viewsPerMinute >= 20_000) {
    score += 50;
    reasons.push("explosive_growth");
  }

  const engagement = likes + comments;
  if (views >= 50_000 && engagement === 0) {
    score += 40;
    reasons.push("zero_engagement");
  } else if (views >= 10_000 && likes > 0 && views / likes > 500) {
    score += 35;
    reasons.push("very_low_engagement");
  } else if (views >= 10_000 && likes > 0 && views / likes > 250) {
    score += 20;
    reasons.push("very_low_engagement");
  }

  if (!input.ownershipVerified) {
    score = Math.max(score, 60);
    reasons.push("ownership_missing");
  }

  const fraudScore = Math.min(96, score);
  return {
    fraudScore,
    requiresReview: fraudScore >= VIEW_RISK_REVIEW_THRESHOLD,
    reasons
  };
}
