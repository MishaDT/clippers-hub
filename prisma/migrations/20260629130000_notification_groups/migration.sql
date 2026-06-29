CREATE TABLE IF NOT EXISTS "_backup_Notification_20260629" AS TABLE "Notification";

ALTER TABLE "Notification"
  ADD COLUMN "groupKey" TEXT,
  ADD COLUMN "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lastOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Notification_userId_groupKey_key"
  ON "Notification"("userId", "groupKey");

DROP INDEX IF EXISTS "Notification_userId_archivedAt_createdAt_idx";
CREATE INDEX "Notification_userId_archivedAt_lastOccurredAt_idx"
  ON "Notification"("userId", "archivedAt", "lastOccurredAt");
