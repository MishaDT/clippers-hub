ALTER TABLE "Campaign"
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Campaign" AS campaign
SET "isDemo" = true
FROM "User" AS owner
WHERE campaign."ownerId" = owner."id"
  AND owner."email" LIKE '%@clippers.local';

CREATE INDEX "Campaign_isDemo_status_idx"
ON "Campaign"("isDemo", "status");
