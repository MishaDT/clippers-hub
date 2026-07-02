UPDATE "Campaign" AS campaign
SET "maxPaidResults" = GREATEST(
  campaign."maxPaidResults",
  (
    SELECT COUNT(*)::INTEGER
    FROM "Submission" AS submission
    WHERE submission."campaignId" = campaign."id"
      AND submission."status" <> 'REJECTED'
  )
);

CREATE TEMPORARY TABLE "_reservation_backfill" AS
WITH eligible AS (
  SELECT
    submission."id" AS "submissionId",
    campaign."id" AS "campaignId",
    ROUND((campaign."viewThreshold"::NUMERIC / 1000) * campaign."cpmRateCents")::INTEGER AS reserve,
    SUM(ROUND((campaign."viewThreshold"::NUMERIC / 1000) * campaign."cpmRateCents")::INTEGER)
      OVER (
        PARTITION BY campaign."id"
        ORDER BY submission."createdAt", submission."id"
      ) AS running_reserve,
    campaign."remainingBudgetCents" AS available
  FROM "Submission" AS submission
  JOIN "Campaign" AS campaign ON campaign."id" = submission."campaignId"
  WHERE submission."reservedPayoutCents" = 0
    AND submission."status" IN ('ACCEPTED', 'POSTED', 'VERIFIED', 'THRESHOLD_MET', 'SETTLING')
)
SELECT "submissionId", "campaignId", reserve
FROM eligible
WHERE reserve > 0 AND running_reserve <= available;

UPDATE "Submission" AS submission
SET "reservedPayoutCents" = backfill.reserve,
    "reservationReleasedAt" = NULL
FROM "_reservation_backfill" AS backfill
WHERE submission."id" = backfill."submissionId";

UPDATE "Campaign" AS campaign
SET "remainingBudgetCents" = campaign."remainingBudgetCents" - totals.reserve,
    "reservedBudgetCents" = campaign."reservedBudgetCents" + totals.reserve
FROM (
  SELECT "campaignId", SUM(reserve)::INTEGER AS reserve
  FROM "_reservation_backfill"
  GROUP BY "campaignId"
) AS totals
WHERE campaign."id" = totals."campaignId";

DROP TABLE "_reservation_backfill";
