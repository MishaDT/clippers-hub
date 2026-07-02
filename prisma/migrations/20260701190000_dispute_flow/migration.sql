ALTER TABLE "DisputeCase"
  ADD COLUMN "resolution" TEXT,
  ADD COLUMN "resolvedById" TEXT,
  ADD COLUMN "openKey" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "DisputeCase_openKey_key" ON "DisputeCase"("openKey");
CREATE INDEX "DisputeCase_submissionId_createdAt_idx" ON "DisputeCase"("submissionId", "createdAt");
CREATE INDEX "DisputeCase_status_createdAt_idx" ON "DisputeCase"("status", "createdAt");
