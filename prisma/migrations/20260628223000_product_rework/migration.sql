ALTER TABLE "User"
  ADD COLUMN "rpPurchasedBalance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "preferredRoleMode" TEXT,
  ADD COLUMN "marketGuideSeenAt" TIMESTAMP(3);

ALTER TABLE "Campaign"
  ADD COLUMN "briefJson" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "CollabInvite"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "endedAt" TIMESTAMP(3);

CREATE TABLE "RecurringRewardClaim" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "rewardRp" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringRewardClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringRewardClaim_userId_code_periodKey_key"
  ON "RecurringRewardClaim"("userId", "code", "periodKey");
CREATE INDEX "RecurringRewardClaim_userId_periodKey_idx"
  ON "RecurringRewardClaim"("userId", "periodKey");

ALTER TABLE "RecurringRewardClaim"
  ADD CONSTRAINT "RecurringRewardClaim_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD CONSTRAINT "User_rp_balances_check"
  CHECK ("rpPurchasedBalance" >= 0 AND "rpPurchasedBalance" <= "rpBalance");
