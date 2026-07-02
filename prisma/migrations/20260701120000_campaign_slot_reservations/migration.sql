ALTER TABLE "Campaign"
ADD COLUMN "reservedBudgetCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxPaidResults" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Submission"
ADD COLUMN "reservedPayoutCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reservationReleasedAt" TIMESTAMP(3);

UPDATE "Campaign"
SET "maxPaidResults" = GREATEST(
  1,
  LEAST(
    20,
    COALESCE(
      NULLIF(("briefJson"::jsonb ->> 'deliverableCount')::integer, 0),
      1
    )
  )
)
WHERE "briefJson" IS NOT NULL
  AND "briefJson" <> ''
  AND "briefJson"::jsonb ? 'deliverableCount';
