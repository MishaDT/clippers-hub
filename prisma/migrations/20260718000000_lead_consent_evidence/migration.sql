-- Existing lead submissions were created through a form with a required consent checkbox.
-- Record the historical form version/date and require explicit evidence for future rows.
ALTER TABLE "BusinessLead"
  ADD COLUMN "consentVersion" TEXT NOT NULL DEFAULT 'legacy-required-checkbox',
  ADD COLUMN "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "BusinessLead"
  ALTER COLUMN "consentVersion" DROP DEFAULT,
  ALTER COLUMN "consentedAt" DROP DEFAULT;
