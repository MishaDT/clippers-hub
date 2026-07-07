-- Growth features: badge bonus, platform-organized seed flag, verified-account gate,
-- advertising/ERID fields, clip share token + brief-accept + badge-confirm + early-removal,
-- self-employed payout details, social-account verification method, dispute platform-fault,
-- and the InvoiceRequest table for юрлицо bank transfers. All additive and safe.

-- Campaign
ALTER TABLE "Campaign" ADD COLUMN "badgeBonusCpmCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN "isPlatformOrganized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN "requireVerifiedAccount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN "isAdvertising" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN "erid" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "advertiserInn" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "advertiserName" TEXT;

-- Submission
ALTER TABLE "Submission" ADD COLUMN "acceptedBriefVersion" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "badgeConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN "earlyRemovalAt" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Submission_shareToken_key" ON "Submission"("shareToken");

-- User (self-employed payout details)
ALTER TABLE "User" ADD COLUMN "payoutInn" TEXT;
ALTER TABLE "User" ADD COLUMN "payoutAccount" TEXT;
ALTER TABLE "User" ADD COLUMN "payoutBik" TEXT;
ALTER TABLE "User" ADD COLUMN "payoutFullName" TEXT;
ALTER TABLE "User" ADD COLUMN "payoutPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "selfEmployedConfirmedAt" TIMESTAMP(3);

-- SocialAccount (verification method for tracking-code-free ownership)
ALTER TABLE "SocialAccount" ADD COLUMN "verificationMethod" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "accountUrl" TEXT;

-- DisputeCase (platform-fault insurance)
ALTER TABLE "DisputeCase" ADD COLUMN "platformFault" BOOLEAN NOT NULL DEFAULT false;

-- InvoiceRequest (юрлицо bank transfers)
CREATE TABLE "InvoiceRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "inn" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "InvoiceRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoiceRequest_userId_createdAt_idx" ON "InvoiceRequest"("userId", "createdAt");
CREATE INDEX "InvoiceRequest_status_createdAt_idx" ON "InvoiceRequest"("status", "createdAt");
ALTER TABLE "InvoiceRequest" ADD CONSTRAINT "InvoiceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
