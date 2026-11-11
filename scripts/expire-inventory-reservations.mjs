import { InventoryReservationStatus, OrderStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const now = new Date();
const batchSize = Math.max(1, Math.min(500, Number.parseInt(process.env.INVENTORY_EXPIRY_BATCH_SIZE || '100', 10) || 100));

async function main() {
  const due = await prisma.inventoryReservation.findMany({
    where: { status: InventoryReservationStatus.ACTIVE, expiresAt: { lte: now } },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
    select: { id: true, orderId: true },
  });

  let expired = 0;
  let consumed = 0;
  let skipped = 0;

  for (const candidate of due) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const reservation = await tx.inventoryReservation.findUnique({
          where: { id: candidate.id },
          include: { order: { select: { status: true } } },
        });
        if (!reservation || reservation.status !== InventoryReservationStatus.ACTIVE || reservation.expiresAt > now) {
          return 'SKIPPED' as const;
        }

        if (reservation.order.status !== OrderStatus.PENDING) {
          const status = reservation.order.status === OrderStatus.CANCELLED
            ? InventoryReservationStatus.RELEASED
            : InventoryReservationStatus.CONSUMED;
          const changed = await tx.inventoryReservation.updateMany({
            where: { id: reservation.id, status: InventoryReservationStatus.ACTIVE },
            data: status === InventoryReservationStatus.CONSUMED
              ? { status, consumedAt: now }
              : { status, releasedAt: now },
          });
          return changed.count === 1 ? (status === InventoryReservationStatus.CONSUMED ? 'CONSUMED' as const : 'SKIPPED' as const) : 'SKIPPED' as const;
        }

        const released = await tx.inventoryReservation.updateMany({
          where: { id: reservation.id, status: InventoryReservationStatus.ACTIVE, expiresAt: { lte: now } },
          data: { status: InventoryReservationStatus.EXPIRED, releasedAt: now },
        });
        if (released.count !== 1) return 'SKIPPED' as const;

        const cancelled = await tx.order.updateMany({
          where: { id: reservation.orderId, status: OrderStatus.PENDING },
          data: { status: OrderStatus.CANCELLED },
        });
        if (cancelled.count !== 1) {
          throw new Error('Order state changed while expiring its inventory reservation; transaction rolled back');
        }

        await tx.product.updateMany({
          where: { id: reservation.productId, stockQuantity: { not: null } },
          data: { stockQuantity: { increment: reservation.quantity } },
        });
        await tx.orderStatusEvent.create({
          data: {
            orderId: reservation.orderId,
            fromStatus: OrderStatus.PENDING,
            toStatus: OrderStatus.CANCELLED,
            reason: 'INVENTORY_RESERVATION_EXPIRED',
          },
        });
        return 'EXPIRED' as const;
      }, { isolationLevel: 'Serializable' });

      if (result === 'EXPIRED') expired += 1;
      else if (result === 'CONSUMED') consumed += 1;
      else skipped += 1;
    } catch (error) {
      skipped += 1;
      process.stderr.write(`reservation ${candidate.id}: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    }
  }

  process.stdout.write(JSON.stringify({
    mode: 'INVENTORY_RESERVATION_EXPIRY',
    dryRun: false,
    scanned: due.length,
    expired,
    consumed,
    skipped,
    checkedAt: now.toISOString(),
  }) + '\n');
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
