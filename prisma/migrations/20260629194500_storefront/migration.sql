CREATE TABLE "StoreOffer" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'RP_REWARD',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "url" TEXT,
  "imageUrl" TEXT,
  "qrImageUrl" TEXT,
  "priceRp" INTEGER NOT NULL DEFAULT 0,
  "stock" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreRedemption" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "costRp" INTEGER NOT NULL,
  "purchasedRpUsed" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "contactEmail" TEXT NOT NULL,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "fulfilledAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  CONSTRAINT "StoreRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreOffer_active_sortOrder_idx" ON "StoreOffer"("active", "sortOrder");
CREATE INDEX "StoreOffer_kind_active_idx" ON "StoreOffer"("kind", "active");
CREATE INDEX "StoreRedemption_userId_createdAt_idx" ON "StoreRedemption"("userId", "createdAt");
CREATE INDEX "StoreRedemption_status_createdAt_idx" ON "StoreRedemption"("status", "createdAt");
CREATE INDEX "StoreRedemption_offerId_createdAt_idx" ON "StoreRedemption"("offerId", "createdAt");

ALTER TABLE "StoreRedemption"
  ADD CONSTRAINT "StoreRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreRedemption"
  ADD CONSTRAINT "StoreRedemption_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "StoreOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "StoreOffer" (
  "id", "kind", "title", "description", "url", "priceRp", "stock",
  "active", "featured", "sortOrder", "metadataJson", "updatedAt"
) VALUES
(
  'store_pampadu_main', 'PAMPADU_WIDGET', 'Партнёрская витрина Pampadu',
  'Банковские продукты и предложения партнёров.',
  'https://ppdu.ru/2f0f0fbc-775f-471a-8cc3-783b3e50b904',
  0, NULL, true, true, 0, '{"scriptUrl":"https://ppdu.ru/ppdw.js"}', CURRENT_TIMESTAMP
),
(
  'store_reward_feature', 'RP_REWARD', 'Продвижение кампании',
  'Подними свою активную кампанию в каталоге на один день.',
  NULL, 100, NULL, true, true, 10, '{"delivery":"digital"}', CURRENT_TIMESTAMP
),
(
  'store_reward_review', 'RP_REWARD', 'Разбор профиля ReelPay',
  'Персональные рекомендации по оформлению профиля и портфолио.',
  NULL, 250, 25, true, false, 20, '{"delivery":"service"}', CURRENT_TIMESTAMP
);
