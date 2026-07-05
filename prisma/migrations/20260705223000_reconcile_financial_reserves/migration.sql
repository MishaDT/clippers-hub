-- holdBalanceCents is derived exclusively from pending earnings.
UPDATE "User" AS u
SET "holdBalanceCents" = COALESCE((
  SELECT SUM(t."netCents")
  FROM "Transaction" AS t
  WHERE t."userId" = u.id
    AND t."type" = 'EARNING'
    AND t."status" = 'PENDING'
), 0)
WHERE u."holdBalanceCents" <> COALESCE((
  SELECT SUM(t."netCents")
  FROM "Transaction" AS t
  WHERE t."userId" = u.id
    AND t."type" = 'EARNING'
    AND t."status" = 'PENDING'
), 0);

-- reservedBudgetCents is the sum of addressable reservations still attached to submissions.
UPDATE "Campaign" AS c
SET "reservedBudgetCents" = COALESCE((
  SELECT SUM(s."reservedPayoutCents")
  FROM "Submission" AS s
  WHERE s."campaignId" = c.id
), 0)
WHERE c."reservedBudgetCents" <> COALESCE((
  SELECT SUM(s."reservedPayoutCents")
  FROM "Submission" AS s
  WHERE s."campaignId" = c.id
), 0);
