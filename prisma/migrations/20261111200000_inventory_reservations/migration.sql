CREATE TYPE "InventoryReservationStatus" AS ENUM (
  'ACTIVE',
  'CONSUMED',
  'RELEASED',
  'EXPIRED'
);

CREATE TABLE "inventory_reservations" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_reservations_quantity_check" CHECK ("quantity" > 0)
);

CREATE INDEX "inventory_reservations_status_expiresAt_idx"
  ON "inventory_reservations"("status", "expiresAt");
CREATE INDEX "inventory_reservations_orderId_status_idx"
  ON "inventory_reservations"("orderId", "status");
CREATE INDEX "inventory_reservations_productId_status_idx"
  ON "inventory_reservations"("productId", "status");

ALTER TABLE "inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
