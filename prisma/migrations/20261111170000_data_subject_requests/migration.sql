CREATE TYPE "DataSubjectRequestStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'COMPLETED'
);

CREATE TABLE "data_subject_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_subject_requests_userId_status_requestedAt_idx"
  ON "data_subject_requests"("userId", "status", "requestedAt");

ALTER TABLE "data_subject_requests"
  ADD CONSTRAINT "data_subject_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
