CREATE TABLE "api_rate_limit_buckets" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMPTZ NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "api_rate_limit_buckets_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "api_rate_limit_buckets_count_positive_check" CHECK ("count" > 0)
);

CREATE INDEX "api_rate_limit_buckets_expiresAt_idx"
  ON "api_rate_limit_buckets" ("expiresAt");
