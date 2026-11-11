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

-- Prevent application-level mutation or deletion of historical transition evidence.
CREATE FUNCTION reject_order_status_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'order status events are append-only';
END;
$$;

CREATE TRIGGER order_status_events_append_only
BEFORE UPDATE OR DELETE ON "order_status_events"
FOR EACH ROW EXECUTE FUNCTION reject_order_status_event_mutation();
