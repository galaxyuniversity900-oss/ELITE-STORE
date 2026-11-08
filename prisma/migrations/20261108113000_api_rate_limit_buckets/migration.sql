CREATE TABLE "api_rate_limit_buckets" (
  "id" VARCHAR(128) NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "api_rate_limit_buckets_resetAt_idx" ON "api_rate_limit_buckets"("resetAt");
