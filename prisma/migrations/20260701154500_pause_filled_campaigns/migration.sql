UPDATE "Campaign" AS campaign
SET "status" = 'PAUSED'
WHERE campaign."status" IN ('ACTIVE', 'LOW_BUDGET')
  AND (
    SELECT COUNT(*)
    FROM "Submission" AS submission
    WHERE submission."campaignId" = campaign."id"
      AND submission."status" <> 'REJECTED'
  ) >= campaign."maxPaidResults";
