-- Append-only audit events for controlled order lifecycle transitions.
CREATE TABLE "order_status_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "fromStatus" "OrderStatus" NOT NULL,
  "toStatus" "OrderStatus" NOT NULL,
  "actorId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_status_events_orderId_createdAt_idx"
  ON "order_status_events"("orderId", "createdAt");
CREATE INDEX "order_status_events_actorId_createdAt_idx"
  ON "order_status_events"("actorId", "createdAt");

ALTER TABLE "order_status_events"
  ADD CONSTRAINT "order_status_events_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
