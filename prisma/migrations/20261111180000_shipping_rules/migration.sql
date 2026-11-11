CREATE TABLE "shipping_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'Egypt',
  "city" TEXT NOT NULL,
  "area" TEXT,
  "shippingMethod" TEXT NOT NULL,
  "fee" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "estimatedMinDays" INTEGER NOT NULL DEFAULT 1,
  "estimatedMaxDays" INTEGER NOT NULL DEFAULT 5,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shipping_rules_country_city_area_shippingMethod_isActive_idx"
  ON "shipping_rules"("country", "city", "area", "shippingMethod", "isActive");

ALTER TABLE "shipping_rules"
  ADD CONSTRAINT "shipping_rules_fee_nonnegative_check" CHECK ("fee" >= 0),
  ADD CONSTRAINT "shipping_rules_estimated_days_check" CHECK ("estimatedMinDays" >= 0 AND "estimatedMaxDays" >= "estimatedMinDays");
