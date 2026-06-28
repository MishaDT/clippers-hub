CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'FROZEN', 'BANNED');

ALTER TABLE "User"
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "specialtiesJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "socialLinksJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "handleChangedAt" TIMESTAMP(3),
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "restrictionReason" TEXT,
  ADD COLUMN "restrictedUntil" TIMESTAMP(3);

ALTER TABLE "Campaign" ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "ChatMessage" ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED';

CREATE TABLE "UserHandleAlias" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserHandleAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioPin" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioPin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationCase" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "entityId" TEXT,
  "authorId" TEXT,
  "reporterId" TEXT,
  "reviewerId" TEXT,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "excerpt" TEXT,
  "payloadJson" TEXT NOT NULL DEFAULT '{}',
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- Keep one submission per worker/order. Child records are moved to the most
-- advanced/newest submission before duplicates are deleted.
CREATE TEMP TABLE "_submission_keep" AS
SELECT id AS duplicate_id,
       FIRST_VALUE(id) OVER (
         PARTITION BY "campaignId", "workerId"
         ORDER BY CASE status
           WHEN 'PAID' THEN 7 WHEN 'SETTLING' THEN 6 WHEN 'THRESHOLD_MET' THEN 5
           WHEN 'VERIFIED' THEN 4 WHEN 'POSTED' THEN 3 WHEN 'ACCEPTED' THEN 2 ELSE 1 END DESC,
           "updatedAt" DESC
       ) AS keep_id
FROM "Submission";

UPDATE "Transaction" t SET "submissionId" = k.keep_id
FROM "_submission_keep" k WHERE t."submissionId" = k.duplicate_id AND k.duplicate_id <> k.keep_id;
UPDATE "DisputeCase" d SET "submissionId" = k.keep_id
FROM "_submission_keep" k WHERE d."submissionId" = k.duplicate_id AND k.duplicate_id <> k.keep_id;
UPDATE "VideoCheck" v SET "submissionId" = k.keep_id
FROM "_submission_keep" k WHERE v."submissionId" = k.duplicate_id AND k.duplicate_id <> k.keep_id;
UPDATE "ChatThread" c SET "submissionId" = k.keep_id
FROM "_submission_keep" k WHERE c."submissionId" = k.duplicate_id AND k.duplicate_id <> k.keep_id;
DELETE FROM "Submission" s USING "_submission_keep" k
WHERE s.id = k.duplicate_id AND k.duplicate_id <> k.keep_id;
DROP TABLE "_submission_keep";

DELETE FROM "ChatMessage"
WHERE type = 'SYSTEM' AND body = 'Исполнитель снова открыл заказ. Можно продолжить обсуждение здесь.';

DELETE FROM "ChatMessage" message
USING (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "threadId", body, type ORDER BY "createdAt" ASC
    ) AS row_number
    FROM "ChatMessage"
    WHERE type = 'SYSTEM'
  ) ranked
  WHERE row_number > 1
) duplicate
WHERE message.id = duplicate.id;

CREATE UNIQUE INDEX "Submission_campaignId_workerId_key" ON "Submission"("campaignId", "workerId");
CREATE UNIQUE INDEX "UserHandleAlias_handle_key" ON "UserHandleAlias"("handle");
CREATE INDEX "UserHandleAlias_userId_idx" ON "UserHandleAlias"("userId");
CREATE UNIQUE INDEX "PortfolioPin_userId_submissionId_key" ON "PortfolioPin"("userId", "submissionId");
CREATE UNIQUE INDEX "PortfolioPin_userId_position_key" ON "PortfolioPin"("userId", "position");
CREATE INDEX "PortfolioPin_userId_position_idx" ON "PortfolioPin"("userId", "position");
CREATE INDEX "ModerationCase_status_severity_createdAt_idx" ON "ModerationCase"("status", "severity", "createdAt");
CREATE INDEX "ModerationCase_authorId_createdAt_idx" ON "ModerationCase"("authorId", "createdAt");
CREATE INDEX "ModerationCase_entityId_contentType_idx" ON "ModerationCase"("entityId", "contentType");

ALTER TABLE "UserHandleAlias" ADD CONSTRAINT "UserHandleAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioPin" ADD CONSTRAINT "PortfolioPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioPin" ADD CONSTRAINT "PortfolioPin_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
