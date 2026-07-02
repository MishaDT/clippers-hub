ALTER TABLE "CollabInvite"
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'Клиппер',
ADD COLUMN "deadline" TIMESTAMP(3);

CREATE INDEX "CollabInvite_campaignId_status_idx"
ON "CollabInvite"("campaignId", "status");

ALTER TABLE "CollabInvite"
ADD CONSTRAINT "CollabInvite_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
