-- Demo/test data must never be inferred from an email suffix. Keep an explicit,
-- indexed origin flag on users and financial ledger rows so every public metric
-- can fail closed.
ALTER TABLE "User"
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Transaction"
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isDemo" = true
WHERE "email" LIKE '%@clippers.local';

UPDATE "Transaction" AS tx
SET "isDemo" = true
WHERE EXISTS (
  SELECT 1
  FROM "User" AS usr
  WHERE usr."id" = tx."userId"
    AND usr."isDemo" = true
)
OR EXISTS (
  SELECT 1
  FROM "Submission" AS submission
  JOIN "Campaign" AS campaign ON campaign."id" = submission."campaignId"
  WHERE submission."id" = tx."submissionId"
    AND campaign."isDemo" = true
)
OR LOWER(COALESCE(tx."provider", '')) = 'demo'
OR COALESCE(tx."providerRef", '') LIKE 'demo_%';

CREATE INDEX "User_isDemo_role_createdAt_idx"
ON "User"("isDemo", "role", "createdAt");

CREATE INDEX "Transaction_isDemo_status_type_createdAt_idx"
ON "Transaction"("isDemo", "status", "type", "createdAt");
