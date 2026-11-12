CREATE TYPE "ReturnRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'COMPLETED'
);

CREATE TABLE "return_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "return_requests_orderId_key" ON "return_requests"("orderId");
CREATE INDEX "return_requests_userId_status_requestedAt_idx"
  ON "return_requests"("userId", "status", "requestedAt");

ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
