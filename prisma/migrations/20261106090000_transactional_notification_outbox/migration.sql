CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DEAD');
CREATE TYPE "NotificationAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'ABANDONED');

CREATE TABLE "notification_outbox" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "eventType" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "recipient" TEXT,
  "payload" JSONB NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockToken" TEXT,
  "sentAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "providerStatus" TEXT,
  "providerStatusAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_delivery_attempts" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "NotificationAttemptStatus" NOT NULL DEFAULT 'STARTED',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "httpStatus" INTEGER,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_delivery_events" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_delivery_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_outbox_dedupeKey_key" ON "notification_outbox"("dedupeKey");
CREATE INDEX "notification_outbox_status_availableAt_createdAt_idx" ON "notification_outbox"("status", "availableAt", "createdAt");
CREATE INDEX "notification_outbox_status_lockedAt_idx" ON "notification_outbox"("status", "lockedAt");
CREATE INDEX "notification_outbox_orderId_createdAt_idx" ON "notification_outbox"("orderId", "createdAt");
CREATE INDEX "notification_outbox_providerMessageId_idx" ON "notification_outbox"("providerMessageId");
CREATE UNIQUE INDEX "notification_delivery_attempts_notificationId_attemptNumber_key" ON "notification_delivery_attempts"("notificationId", "attemptNumber");
CREATE INDEX "notification_delivery_attempts_notificationId_startedAt_idx" ON "notification_delivery_attempts"("notificationId", "startedAt");
CREATE UNIQUE INDEX "notification_delivery_events_provider_providerEventId_key" ON "notification_delivery_events"("provider", "providerEventId");
CREATE INDEX "notification_delivery_events_notificationId_occurredAt_idx" ON "notification_delivery_events"("notificationId", "occurredAt");

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_attempts"
  ADD CONSTRAINT "notification_delivery_attempts_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "notification_outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_events"
  ADD CONSTRAINT "notification_delivery_events_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "notification_outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
