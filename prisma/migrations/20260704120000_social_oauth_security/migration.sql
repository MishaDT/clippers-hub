ALTER TABLE "SocialAccount"
ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "scopesJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "SocialAccount_userId_platform_idx"
ON "SocialAccount"("userId", "platform");
