ALTER TABLE "Transaction" ADD COLUMN "providerRef" TEXT;

UPDATE "Transaction"
SET "providerRef" = "providerData"::jsonb ->> 'id'
WHERE "type" = 'DEPOSIT'
  AND "provider" IS NOT NULL
  AND "providerData" IS NOT NULL
  AND "providerData" <> '';

CREATE UNIQUE INDEX "Transaction_provider_providerRef_key"
ON "Transaction"("provider", "providerRef");
