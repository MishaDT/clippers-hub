ALTER TABLE "SocialAccount"
  ADD COLUMN "connectionStatus" TEXT NOT NULL DEFAULT 'CONNECTED',
  ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
  ADD COLUMN "reconnectReason" TEXT;

ALTER TABLE "Campaign" ADD COLUMN "strictVerification" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Submission"
  ADD COLUMN "socialAccountId" TEXT,
  ADD COLUMN "visualProofTokenHash" TEXT,
  ADD COLUMN "visualProofConfirmedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Submission_visualProofTokenHash_key" ON "Submission"("visualProofTokenHash");
CREATE UNIQUE INDEX "Submission_platform_platformPostId_live_key"
  ON "Submission"("platform", "platformPostId")
  WHERE "platformPostId" NOT LIKE 'draft_%' AND "postUrl" <> 'https://example.com/post-link-waiting';
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SocialCredential" (
  "id" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT,
  "encryptionKeyId" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "scopesJson" TEXT NOT NULL DEFAULT '[]',
  "refreshVersion" INTEGER NOT NULL DEFAULT 0,
  "revokePendingAt" TIMESTAMP(3),
  "lastRefreshAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialCredential_socialAccountId_key" ON "SocialCredential"("socialAccountId");
ALTER TABLE "SocialCredential" ADD CONSTRAINT "SocialCredential_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing encrypted TikTok credentials before removing them from the public account row.
INSERT INTO "SocialCredential" (
  "id", "socialAccountId", "accessTokenEncrypted", "refreshTokenEncrypted", "encryptionKeyId",
  "tokenExpiresAt", "refreshTokenExpiresAt", "scopesJson", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || "id"), "id", "accessToken", "refreshToken", 'legacy-v1',
  "tokenExpiresAt", "refreshTokenExpiresAt", "scopesJson", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "SocialAccount" WHERE "accessToken" IS NOT NULL;

CREATE TABLE "SocialOAuthChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "stateHash" TEXT NOT NULL,
  "sessionHash" TEXT NOT NULL,
  "pkceVerifier" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialOAuthChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialOAuthChallenge_stateHash_key" ON "SocialOAuthChallenge"("stateHash");
CREATE INDEX "SocialOAuthChallenge_userId_platform_createdAt_idx" ON "SocialOAuthChallenge"("userId", "platform", "createdAt");
CREATE INDEX "SocialOAuthChallenge_expiresAt_usedAt_idx" ON "SocialOAuthChallenge"("expiresAt", "usedAt");
ALTER TABLE "SocialOAuthChallenge" ADD CONSTRAINT "SocialOAuthChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubmissionOwnershipEvidence" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "socialAccountId" TEXT,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "platformPostId" TEXT,
  "source" TEXT NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "detailsJson" TEXT NOT NULL DEFAULT '{}',
  "moderatorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionOwnershipEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubmissionOwnershipEvidence_submissionId_createdAt_idx" ON "SubmissionOwnershipEvidence"("submissionId", "createdAt");
CREATE INDEX "SubmissionOwnershipEvidence_status_createdAt_idx" ON "SubmissionOwnershipEvidence"("status", "createdAt");
CREATE INDEX "SubmissionOwnershipEvidence_socialAccountId_createdAt_idx" ON "SubmissionOwnershipEvidence"("socialAccountId", "createdAt");
ALTER TABLE "SubmissionOwnershipEvidence" ADD CONSTRAINT "SubmissionOwnershipEvidence_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SocialRevocationJob" (
  "id" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "accountIdSnapshot" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialRevocationJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SocialRevocationJob_status_nextAttemptAt_idx" ON "SocialRevocationJob"("status", "nextAttemptAt");
