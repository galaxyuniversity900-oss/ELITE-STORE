-- Demo-ready payment, shipping and customer order tracking foundation.
-- All providers are explicitly simulated; no real payment capture or courier booking occurs.
ALTER TABLE "orders"
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CASH_ON_DELIVERY',
  ADD COLUMN "shippingMethod" TEXT NOT NULL DEFAULT 'DEMO_STANDARD';

CREATE TABLE "shipments" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'DEMO_COURIER',
  "service" TEXT NOT NULL DEFAULT 'DEMO_STANDARD',
  "trackingNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'LABEL_CREATED',
  "estimatedDays" INTEGER NOT NULL DEFAULT 3,
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipments_estimated_days_positive_check" CHECK ("estimatedDays" > 0)
);
CREATE TABLE "tracking_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "shipmentId" TEXT,
  "status" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shipments_orderId_key" ON "shipments"("orderId");
CREATE UNIQUE INDEX "shipments_trackingNumber_key" ON "shipments"("trackingNumber");
CREATE INDEX "shipments_status_createdAt_idx" ON "shipments"("status", "createdAt");
CREATE INDEX "tracking_events_orderId_occurredAt_idx" ON "tracking_events"("orderId", "occurredAt");
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
