CREATE TYPE "CollabAvailability" AS ENUM ('ACTIVE_ROLE', 'BOTH', 'NONE');
CREATE TYPE "ReferralStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'FLAGGED', 'BLOCKED');
CREATE TYPE "ReferralCommissionSide" AS ENUM ('CLIENT', 'WORKER');
CREATE TYPE "ReferralCommissionStatus" AS ENUM ('HELD', 'AVAILABLE', 'REVERSED');

ALTER TABLE "User"
  ADD COLUMN "collabAvailability" "CollabAvailability" NOT NULL DEFAULT 'ACTIVE_ROLE';

ALTER TABLE "CollabInvite" ADD COLUMN "initiatorId" TEXT;
UPDATE "CollabInvite" SET "initiatorId" = "clientId" WHERE "initiatorId" IS NULL;
ALTER TABLE "CollabInvite" ALTER COLUMN "initiatorId" SET NOT NULL;

CREATE TABLE "ReferralProgramConfig" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "attributionDays" INTEGER NOT NULL DEFAULT 30,
  "activationRewardRp" INTEGER NOT NULL DEFAULT 25,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralProgramConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralTier" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "minActiveReferrals" INTEGER NOT NULL,
  "rateBps" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralRelation" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "codeSnapshot" TEXT NOT NULL,
  "status" "ReferralStatus" NOT NULL DEFAULT 'REGISTERED',
  "qualifiedAt" TIMESTAMP(3),
  "flaggedAt" TIMESTAMP(3),
  "flagReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralRelation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralCommission" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "relationId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "side" "ReferralCommissionSide" NOT NULL,
  "rateBps" INTEGER NOT NULL,
  "baseFeeCents" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "ReferralCommissionStatus" NOT NULL DEFAULT 'AVAILABLE',
  "releasedAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralClick" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "codeSnapshot" TEXT NOT NULL,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "landingPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralClick_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralTier_minActiveReferrals_key" ON "ReferralTier"("minActiveReferrals");
CREATE INDEX "ReferralTier_active_minActiveReferrals_idx" ON "ReferralTier"("active", "minActiveReferrals");
CREATE UNIQUE INDEX "ReferralRelation_referredUserId_key" ON "ReferralRelation"("referredUserId");
CREATE INDEX "ReferralRelation_referrerId_status_createdAt_idx" ON "ReferralRelation"("referrerId", "status", "createdAt");
CREATE UNIQUE INDEX "ReferralCommission_transactionId_referredUserId_key" ON "ReferralCommission"("transactionId", "referredUserId");
CREATE INDEX "ReferralCommission_referrerId_status_createdAt_idx" ON "ReferralCommission"("referrerId", "status", "createdAt");
CREATE INDEX "ReferralCommission_referredUserId_createdAt_idx" ON "ReferralCommission"("referredUserId", "createdAt");
CREATE INDEX "ReferralClick_referrerId_createdAt_idx" ON "ReferralClick"("referrerId", "createdAt");
CREATE INDEX "ReferralClick_ipHash_createdAt_idx" ON "ReferralClick"("ipHash", "createdAt");
CREATE INDEX "CollabInvite_initiatorId_status_idx" ON "CollabInvite"("initiatorId", "status");

ALTER TABLE "ReferralRelation" ADD CONSTRAINT "ReferralRelation_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralRelation" ADD CONSTRAINT "ReferralRelation_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "ReferralRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollabInvite" ADD CONSTRAINT "CollabInvite_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ReferralProgramConfig" ("id", "enabled", "attributionDays", "activationRewardRp", "updatedAt")
VALUES ('default', true, 30, 25, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ReferralTier" ("id", "title", "minActiveReferrals", "rateBps", "sortOrder", "active", "updatedAt")
VALUES
  ('ref-tier-1', 'Старт', 1, 500, 10, true, CURRENT_TIMESTAMP),
  ('ref-tier-5', 'Партнёр', 5, 1000, 20, true, CURRENT_TIMESTAMP),
  ('ref-tier-20', 'Профи', 20, 1500, 30, true, CURRENT_TIMESTAMP),
  ('ref-tier-50', 'Амбассадор', 50, 2000, 40, true, CURRENT_TIMESTAMP)
ON CONFLICT ("minActiveReferrals") DO NOTHING;

INSERT INTO "ReferralRelation" (
  "id", "referrerId", "referredUserId", "codeSnapshot", "status", "qualifiedAt", "createdAt", "updatedAt"
)
SELECT
  'legacy-' || referred."id",
  referrer."id",
  referred."id",
  referrer."referralCode",
  CASE WHEN EXISTS (
    SELECT 1 FROM "Submission" s
    LEFT JOIN "Campaign" c ON c."id" = s."campaignId"
    WHERE s."status" = 'PAID'
      AND (s."workerId" = referred."id" OR c."ownerId" = referred."id")
  ) THEN 'ACTIVE'::"ReferralStatus" ELSE 'REGISTERED'::"ReferralStatus" END,
  CASE WHEN EXISTS (
    SELECT 1 FROM "Submission" s
    LEFT JOIN "Campaign" c ON c."id" = s."campaignId"
    WHERE s."status" = 'PAID'
      AND (s."workerId" = referred."id" OR c."ownerId" = referred."id")
  ) THEN CURRENT_TIMESTAMP ELSE NULL END,
  referred."createdAt",
  CURRENT_TIMESTAMP
FROM "User" referred
JOIN "User" referrer ON referrer."referralCode" = referred."referredBy"
WHERE referred."referredBy" IS NOT NULL
ON CONFLICT ("referredUserId") DO NOTHING;
