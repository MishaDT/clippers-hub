CREATE TYPE "ReviewMode" AS ENUM ('FAST', 'STANDARD', 'STRICT');
CREATE TYPE "DraftReviewStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

ALTER TABLE "Campaign"
ADD COLUMN "reviewMode" "ReviewMode" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "maxRevisionRounds" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "briefVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "draftRequired" BOOLEAN NOT NULL DEFAULT true;

-- Existing live campaigns keep their previous direct-publication flow.
UPDATE "Campaign" SET "draftRequired" = false;

ALTER TABLE "Submission"
ADD COLUMN "draftUrl" TEXT,
ADD COLUMN "draftStatus" "DraftReviewStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN "draftRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "draftSubmittedAt" TIMESTAMP(3),
ADD COLUMN "draftReviewedAt" TIMESTAMP(3),
ADD COLUMN "draftReviewNote" TEXT,
ADD COLUMN "draftReviewedById" TEXT,
ADD COLUMN "publishApprovedAt" TIMESTAMP(3);

CREATE INDEX "Submission_draftStatus_draftSubmittedAt_idx"
ON "Submission"("draftStatus", "draftSubmittedAt");
