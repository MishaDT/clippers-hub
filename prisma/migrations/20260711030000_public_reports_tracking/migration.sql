ALTER TABLE "Submission" ADD COLUMN "shareTokenExpiresAt" TIMESTAMP(3), ADD COLUMN "shareTokenRevokedAt" TIMESTAMP(3);

CREATE TABLE "CampaignTrackingLink" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignTrackingLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignClick" (
  "id" TEXT NOT NULL,
  "trackingLinkId" TEXT NOT NULL,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "refererHost" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignClick_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignTrackingLink_code_key" ON "CampaignTrackingLink"("code");
CREATE INDEX "CampaignTrackingLink_campaignId_createdAt_idx" ON "CampaignTrackingLink"("campaignId", "createdAt");
CREATE INDEX "CampaignClick_trackingLinkId_createdAt_idx" ON "CampaignClick"("trackingLinkId", "createdAt");
CREATE INDEX "CampaignClick_ipHash_createdAt_idx" ON "CampaignClick"("ipHash", "createdAt");

ALTER TABLE "CampaignTrackingLink" ADD CONSTRAINT "CampaignTrackingLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignClick" ADD CONSTRAINT "CampaignClick_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "CampaignTrackingLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
