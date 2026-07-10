CREATE TYPE "BusinessLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DRAFT', 'FUNDED', 'WON', 'LOST');

CREATE TABLE "BusinessLead" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "assignedAdminId" TEXT,
  "name" TEXT NOT NULL,
  "contact" TEXT NOT NULL,
  "contentUrl" TEXT,
  "budgetCents" INTEGER NOT NULL DEFAULT 0,
  "goal" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'landing',
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "status" "BusinessLeadStatus" NOT NULL DEFAULT 'NEW',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessLead_status_createdAt_idx" ON "BusinessLead"("status", "createdAt");
CREATE INDEX "BusinessLead_assignedAdminId_status_idx" ON "BusinessLead"("assignedAdminId", "status");
CREATE INDEX "BusinessLead_source_createdAt_idx" ON "BusinessLead"("source", "createdAt");

ALTER TABLE "BusinessLead" ADD CONSTRAINT "BusinessLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessLead" ADD CONSTRAINT "BusinessLead_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
