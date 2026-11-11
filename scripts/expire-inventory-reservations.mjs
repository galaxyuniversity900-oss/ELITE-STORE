import { InventoryReservationStatus, OrderStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const now = new Date();
const batchSize = Math.max(1, Math.min(500, Number.parseInt(process.env.INVENTORY_EXPIRY_BATCH_SIZE || '100', 10) || 100));

async function main() {
  const due = await prisma.inventoryReservation.findMany({
    where: { status: InventoryReservationStatus.ACTIVE, expiresAt: { lte: now } },
    orderBy: [{ expiresAt: 'asc' }, { orderId: 'asc' }],
    take: batchSize,
    select: { orderId: true },
  });
  const orderIds = [...new Set(due.map((item) => item.orderId))];

  let expiredOrders = 0;
  let releasedReservations = 0;
  let consumedReservations = 0;
  let skippedOrders = 0;

  for (const orderId of orderIds) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
        const reservations = await tx.inventoryReservation.findMany({
          where: { orderId, status: InventoryReservationStatus.ACTIVE, expiresAt: { lte: now } },
        });
        if (!order || reservations.length === 0) return { kind: 'SKIPPED' as const, count: 0 };

        if (order.status !== OrderStatus.PENDING) {
          const nextStatus = order.status === OrderStatus.CANCELLED
            ? InventoryReservationStatus.RELEASED
            : InventoryReservationStatus.CONSUMED;
          const changed = await tx.inventoryReservation.updateMany({
            where: { orderId, status: InventoryReservationStatus.ACTIVE, expiresAt: { lte: now } },
            data: nextStatus === InventoryReservationStatus.CONSUMED
              ? { status: nextStatus, consumedAt: now }
              : { status: nextStatus, releasedAt: now },
          });
          return {
            kind: nextStatus === InventoryReservationStatus.CONSUMED ? 'CONSUMED' as const : 'SKIPPED' as const,
            count: changed.count,
          };
        }

        const cancelled = await tx.order.updateMany({
          where: { id: orderId, status: OrderStatus.PENDING },
          data: { status: OrderStatus.CANCELLED },
        });
        if (cancelled.count !== 1) throw new Error('Order state changed while expiring reservations; transaction rolled back');

        const released = await tx.inventoryReservation.updateMany({
          where: { orderId, status: InventoryReservationStatus.ACTIVE, expiresAt: { lte: now } },
          data: { status: InventoryReservationStatus.EXPIRED, releasedAt: now },
        });
        if (released.count !== reservations.length) throw new Error('Reservation set changed during expiry; transaction rolled back');

        for (const reservation of reservations) {
          await tx.product.updateMany({
            where: { id: reservation.productId, stockQuantity: { not: null } },
            data: { stockQuantity: { increment: reservation.quantity } },
          });
        }
        await tx.orderStatusEvent.create({
          data: {
            orderId,
            fromStatus: OrderStatus.PENDING,
            toStatus: OrderStatus.CANCELLED,
            reason: 'INVENTORY_RESERVATION_EXPIRED',
          },
        });
        return { kind: 'EXPIRED' as const, count: released.count };
      }, { isolationLevel: 'Serializable' });

      if (result.kind === 'EXPIRED') {
        expiredOrders += 1;
        releasedReservations += result.count;
      } else if (result.kind === 'CONSUMED') {
        consumedReservations += result.count;
      } else {
        skippedOrders += 1;
      }
    } catch (error) {
      skippedOrders += 1;
      process.stderr.write(`order ${orderId}: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    }
  }

  process.stdout.write(JSON.stringify({
    mode: 'INVENTORY_RESERVATION_EXPIRY',
    dryRun: false,
    scannedReservations: due.length,
    scannedOrders: orderIds.length,
    expiredOrders,
    releasedReservations,
    consumedReservations,
    skippedOrders,
    checkedAt: now.toISOString(),
  }) + '\n');
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
