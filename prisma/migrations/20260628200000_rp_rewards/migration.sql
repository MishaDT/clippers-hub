ALTER TABLE "User" ADD COLUMN "rpBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN "featuredUntil" TIMESTAMP(3);
ALTER TABLE "UserAchievement"
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "rewardRp" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RpTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RpTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RpTransaction_reference_key" ON "RpTransaction"("reference");
CREATE INDEX "RpTransaction_userId_createdAt_idx" ON "RpTransaction"("userId", "createdAt");
CREATE INDEX "RpTransaction_type_createdAt_idx" ON "RpTransaction"("type", "createdAt");
CREATE INDEX "Campaign_featuredUntil_idx" ON "Campaign"("featuredUntil");

ALTER TABLE "RpTransaction"
  ADD CONSTRAINT "RpTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
