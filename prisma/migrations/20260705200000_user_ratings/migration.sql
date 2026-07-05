CREATE TYPE "RatingRole" AS ENUM ('CLIENT', 'WORKER');

CREATE TABLE "UserRating" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "authorRole" "RatingRole" NOT NULL,
  "score" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserRating_submissionId_authorId_key" ON "UserRating"("submissionId", "authorId");
CREATE INDEX "UserRating_subjectId_createdAt_idx" ON "UserRating"("subjectId", "createdAt");
CREATE INDEX "UserRating_subjectId_score_idx" ON "UserRating"("subjectId", "score");

ALTER TABLE "UserRating"
  ADD CONSTRAINT "UserRating_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRating"
  ADD CONSTRAINT "UserRating_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRating"
  ADD CONSTRAINT "UserRating_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
