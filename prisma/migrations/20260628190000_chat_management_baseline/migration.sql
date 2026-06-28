ALTER TABLE "ChatThread"
  ADD COLUMN "clientArchivedAt" TIMESTAMP(3),
  ADD COLUMN "workerArchivedAt" TIMESTAMP(3),
  ADD COLUMN "clientClearedAt" TIMESTAMP(3),
  ADD COLUMN "workerClearedAt" TIMESTAMP(3);

ALTER TABLE "ChatMessage"
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "ChatMessageEdit" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "editorId" TEXT NOT NULL,
  "previousBody" TEXT NOT NULL,
  "newBody" TEXT,
  "action" TEXT NOT NULL DEFAULT 'EDIT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessageEdit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessageEdit_messageId_createdAt_idx" ON "ChatMessageEdit"("messageId", "createdAt");
CREATE INDEX "ChatMessageEdit_threadId_createdAt_idx" ON "ChatMessageEdit"("threadId", "createdAt");
CREATE INDEX "ChatMessageEdit_createdAt_idx" ON "ChatMessageEdit"("createdAt");

ALTER TABLE "ChatMessageEdit"
  ADD CONSTRAINT "ChatMessageEdit_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessageEdit"
  ADD CONSTRAINT "ChatMessageEdit_editorId_fkey"
  FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
