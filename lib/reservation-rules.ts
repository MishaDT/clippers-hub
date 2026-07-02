export function nextCampaignStatusAfterReservation({
  currentStatus,
  nextRemaining,
  reserve,
  occupiedAfter,
  maxPaidResults
}: {
  currentStatus: "ACTIVE" | "LOW_BUDGET";
  nextRemaining: number;
  reserve: number;
  occupiedAfter: number;
  maxPaidResults: number;
}) {
  if (occupiedAfter >= maxPaidResults || nextRemaining <= 0) return "PAUSED" as const;
  if (nextRemaining < reserve) return "LOW_BUDGET" as const;
  return currentStatus;
}
