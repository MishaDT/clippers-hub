ALTER TABLE "ChatThread"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'CAMPAIGN',
  ADD COLUMN "collabInviteId" TEXT;

ALTER TABLE "ChatThread" ALTER COLUMN "campaignId" DROP NOT NULL;

CREATE UNIQUE INDEX "ChatThread_collabInviteId_key" ON "ChatThread"("collabInviteId");
CREATE INDEX "ChatThread_kind_updatedAt_idx" ON "ChatThread"("kind", "updatedAt");

ALTER TABLE "ChatThread"
  ADD CONSTRAINT "ChatThread_collabInviteId_fkey"
  FOREIGN KEY ("collabInviteId") REFERENCES "CollabInvite"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Notification_userId_archivedAt_createdAt_idx"
  ON "Notification"("userId", "archivedAt", "createdAt");
