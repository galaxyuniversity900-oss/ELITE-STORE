import { NotificationStatus, OrderStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const confirmation = process.env.ORDER_PII_RETENTION_CONFIRM;
const retentionDays = Number(process.env.ORDER_PII_RETENTION_DAYS);

async function main() {
  if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 3650) {
    throw new Error('Set ORDER_PII_RETENTION_DAYS to an approved integer between 30 and 3650');
  }
  if (apply && confirmation !== 'REDACT_TERMINAL_ORDER_PII') {
    throw new Error('Apply requires ORDER_PII_RETENTION_CONFIRM=REDACT_TERMINAL_ORDER_PII');
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const where = {
    createdAt: { lt: cutoff },
    customerPhone: { not: '[REDACTED]' },
    status: { in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    notifications: {
      none: { status: { in: [NotificationStatus.PENDING, NotificationStatus.PROCESSING] } },
    },
  };

  const eligible = await prisma.order.count({ where });
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    retentionDays,
    cutoff: cutoff.toISOString(),
    eligibleOrders: eligible,
    changedOrders: 0,
    note: 'Only terminal orders with no pending/processing notification jobs are eligible.',
  }, null, 2));
  if (!apply || eligible === 0) return;

  let changedOrders = 0;
  let changedNotifications = 0;
  while (true) {
    const batch = await prisma.order.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 250,
    });
    if (batch.length === 0) break;
    const ids = batch.map((item) => item.id);
    const result = await prisma.$transaction(async (tx) => {
      const orders = await tx.order.updateMany({
        where: { id: { in: ids } },
        data: {
          customerName: '[REDACTED]',
          customerPhone: '[REDACTED]',
          customerEmail: null,
          shippingAddress: { redacted: true, redactedAt: new Date().toISOString() },
          notes: null,
          addressId: null,
        },
      });
      const notifications = await tx.notificationOutbox.updateMany({
        where: { orderId: { in: ids } },
        data: { recipient: null, payload: {} },
      });
      return { orders: orders.count, notifications: notifications.count };
    });
    changedOrders += result.orders;
    changedNotifications += result.notifications;
    console.log('Redacted batch: ' + result.orders + ' orders; ' + result.notifications + ' notification payloads.');
  }

  console.log(JSON.stringify({ mode: 'apply', changedOrders, changedNotifications }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Order PII retention failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
