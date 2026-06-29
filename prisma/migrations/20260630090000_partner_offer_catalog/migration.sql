ALTER TABLE "StoreOffer"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "licenseNumber" TEXT,
  ADD COLUMN "disclaimer" TEXT,
  ADD COLUMN "featuresJson" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "importedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "StoreOffer_externalId_key" ON "StoreOffer"("externalId");
CREATE INDEX "StoreOffer_source_category_active_idx" ON "StoreOffer"("source", "category", "active");
