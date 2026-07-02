UPDATE "Campaign" AS campaign
SET "maxPaidResults" = GREATEST(
      campaign."maxPaidResults",
      (
        SELECT COUNT(*)::INTEGER + 3
        FROM "Submission" AS submission
        WHERE submission."campaignId" = campaign."id"
          AND submission."status" <> 'REJECTED'
      )
    ),
    "status" = CASE
      WHEN campaign."deadline" > NOW()
        AND campaign."remainingBudgetCents" >= ROUND((campaign."viewThreshold"::NUMERIC / 1000) * campaign."cpmRateCents")::INTEGER
      THEN 'ACTIVE'::"CampaignStatus"
      ELSE campaign."status"
    END
WHERE campaign."isDemo" = true;
