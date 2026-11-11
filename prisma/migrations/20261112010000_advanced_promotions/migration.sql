CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED');

CREATE TABLE "promotions" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PromotionType" NOT NULL,
  "value" DECIMAL(12,2) NOT NULL,
  "minSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maxDiscount" DECIMAL(12,2),
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promotions_value_positive_check" CHECK ("value" > 0),
  CONSTRAINT "promotions_min_subtotal_nonnegative_check" CHECK ("minSubtotal" >= 0),
  CONSTRAINT "promotions_usage_count_nonnegative_check" CHECK ("usageCount" >= 0),
  CONSTRAINT "promotions_usage_limit_check" CHECK ("usageLimit" IS NULL OR "usageLimit" >= 0),
  CONSTRAINT "promotions_dates_check" CHECK ("startsAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt" > "startsAt")
);
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");
CREATE INDEX "promotions_isActive_startsAt_expiresAt_idx" ON "promotions"("isActive", "startsAt", "expiresAt");

CREATE TABLE "promotion_redemptions" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promotion_redemptions_discount_nonnegative_check" CHECK ("discountAmount" >= 0)
);
CREATE UNIQUE INDEX "promotion_redemptions_orderId_key" ON "promotion_redemptions"("orderId");
CREATE UNIQUE INDEX "promotion_redemptions_promotionId_orderId_key" ON "promotion_redemptions"("promotionId", "orderId");
CREATE INDEX "promotion_redemptions_promotionId_createdAt_idx" ON "promotion_redemptions"("promotionId", "createdAt");

ALTER TABLE "promotion_redemptions"
  ADD CONSTRAINT "promotion_redemptions_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "promotions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "promotion_redemptions"
  ADD CONSTRAINT "promotion_redemptions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
