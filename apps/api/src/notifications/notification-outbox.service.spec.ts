import { NotificationAttemptStatus, NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { NotificationOutboxService } from './notification-outbox.service';

describe('NotificationOutboxService', () => {
  const prisma = {
    notificationOutbox: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    notificationDeliveryAttempt: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationDeliveryEvent: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((work: unknown) => typeof work === 'function'
      ? (work as (tx: unknown) => unknown)({
          $queryRaw: prisma.$queryRaw,
          notificationOutbox: prisma.notificationOutbox,
          notificationDeliveryAttempt: prisma.notificationDeliveryAttempt,
        })
      : Promise.all(work as Promise<unknown>[]));
  });

  it('enqueues WhatsApp and email records in the order transaction with stable dedupe keys', async () => {
    const tx = { notificationOutbox: { createMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    const service = new NotificationOutboxService(prisma as never);
    process.env.WHATSAPP_ORDER_RECIPIENT = '201000000000';
    process.env.ORDER_NOTIFICATION_EMAIL = 'orders@example.test';

    await service.enqueueOrderCreated(tx as never, {
      id: 'order-1',
      orderNumber: 'MES-1',
      customerName: 'Test',
      customerPhone: '+201000000000',
      grandTotal: '245.00',
      currency: 'EGP',
      shippingAddress: { city: 'Cairo', street: 'Main street' },
      items: [{ productName: 'Shirt', sku: 'SH-1', quantity: 2 }],
    });

    const call = tx.notificationOutbox.createMany.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data).toHaveLength(2);
    expect(call.data.map((item: any) => item.dedupeKey)).toEqual([
      'order-1:ORDER_CREATED:WHATSAPP',
      'order-1:ORDER_CREATED:EMAIL',
    ]);
    expect(call.data[0].channel).toBe(NotificationChannel.WHATSAPP);
    expect(call.data[1].channel).toBe(NotificationChannel.EMAIL);
  });

  it('does not assign a fallback WhatsApp recipient when configuration is missing', async () => {
    const previous = process.env.WHATSAPP_ORDER_RECIPIENT;
    delete process.env.WHATSAPP_ORDER_RECIPIENT;
    const tx = { notificationOutbox: { createMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    const service = new NotificationOutboxService(prisma as never);

    try {
      await service.enqueueOrderCreated(tx as never, {
        id: 'order-no-default-recipient',
        orderNumber: 'MES-NO-RECIPIENT',
        customerName: 'Test',
        customerPhone: '+201000000000',
        grandTotal: '10.00',
        currency: 'EGP',
        shippingAddress: {},
        items: [],
      });
      const rows = tx.notificationOutbox.createMany.mock.calls[0][0].data;
      expect(rows.find((row: any) => row.channel === NotificationChannel.WHATSAPP).recipient).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.WHATSAPP_ORDER_RECIPIENT;
      else process.env.WHATSAPP_ORDER_RECIPIENT = previous;
    }
  });

  it('marks an accepted WhatsApp message SENT and records the provider message ID', async () => {
    const notification = {
      id: 'outbox-1',
      channel: NotificationChannel.WHATSAPP,
      recipient: '201000000000',
      payload: { orderNumber: 'MES-1', customerName: 'Test', customerPhone: '0100', total: '245', currency: 'EGP', items: 'Shirt', address: 'Cairo' },
      dedupeKey: 'order-1:ORDER_CREATED:WHATSAPP',
      attempts: 1,
      maxAttempts: 8,
      lockToken: 'lock-1',
    };
    prisma.notificationOutbox.findMany.mockResolvedValueOnce([]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'outbox-1', attempts: 0 }]);
    let activeLock = '';
    prisma.notificationOutbox.updateMany.mockImplementation(async (args: any) => {
      if (args.data.status === NotificationStatus.PROCESSING) activeLock = args.data.lockToken;
      return { count: 1 };
    });
    prisma.notificationOutbox.findUnique.mockImplementation(async () => ({ ...notification, lockToken: activeLock }));
    prisma.notificationDeliveryAttempt.create.mockResolvedValue({ id: 'attempt-1' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.test-1' }] }),
    }) as never;
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_ORDER_TEMPLATE_NAME = 'order_alert';
    process.env.WHATSAPP_API_VERSION = 'v99.0';

    const service = new NotificationOutboxService(prisma as never);
    await service.processBatch();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(prisma.notificationOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'outbox-1', status: NotificationStatus.PROCESSING, lockToken: expect.any(String) },
      data: expect.objectContaining({
        status: NotificationStatus.SENT,
        providerMessageId: 'wamid.test-1',
        providerStatus: 'accepted',
      }),
    }));
  });

  it('uses provider recipient configuration added after the notification was queued', async () => {
    const notification = {
      id: 'outbox-configured-later',
      channel: NotificationChannel.EMAIL,
      recipient: null,
      payload: { orderNumber: 'MES-LATER', subject: 'New order', customerName: 'Test', customerPhone: '0100', total: '245', currency: 'EGP', items: [], address: '' },
      dedupeKey: 'order-later:ORDER_CREATED:EMAIL',
      attempts: 1,
      maxAttempts: 8,
      lockToken: 'lock-later',
    };
    prisma.notificationOutbox.findMany.mockResolvedValueOnce([]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: notification.id, attempts: 0 }]);
    let activeLock = '';
    prisma.notificationOutbox.updateMany.mockImplementation(async (args: any) => {
      if (args.data.status === NotificationStatus.PROCESSING) activeLock = args.data.lockToken;
      return { count: 1 };
    });
    prisma.notificationOutbox.findUnique.mockImplementation(async () => ({ ...notification, lockToken: activeLock }));
    prisma.notificationDeliveryAttempt.create.mockResolvedValue({ id: 'attempt-later' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'resend-later-1' }),
    }) as never;
    process.env.ORDER_NOTIFICATION_EMAIL = 'orders@example.test';
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'MES STORE <orders@example.test>';

    const service = new NotificationOutboxService(prisma as never);
    await service.processBatch();

    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body).to).toEqual(['orders@example.test']);
    expect(request.headers['Idempotency-Key']).toBe(notification.dedupeKey);
  });

  it('schedules retry after a transient provider 503 response', async () => {
    const notification = {
      id: 'outbox-2',
      channel: NotificationChannel.EMAIL,
      recipient: 'orders@example.test',
      payload: { orderNumber: 'MES-2', subject: 'New order', customerName: 'Test', customerPhone: '0100', total: '245', currency: 'EGP', items: [], address: '' },
      dedupeKey: 'order-2:ORDER_CREATED:EMAIL',
      attempts: 1,
      maxAttempts: 8,
      lockToken: 'lock-2',
    };
    prisma.notificationOutbox.findMany.mockResolvedValueOnce([]);
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'outbox-2', attempts: 0 }]);
    let activeLock = '';
    prisma.notificationOutbox.updateMany.mockImplementation(async (args: any) => {
      if (args.data.status === NotificationStatus.PROCESSING) activeLock = args.data.lockToken;
      return { count: 1 };
    });
    prisma.notificationOutbox.findUnique.mockImplementation(async () => ({ ...notification, lockToken: activeLock }));
    prisma.notificationDeliveryAttempt.create.mockResolvedValue({ id: 'attempt-2' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as never;
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'MES STORE <orders@example.test>';

    const service = new NotificationOutboxService(prisma as never);
    await service.processBatch();

    expect(prisma.notificationOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: NotificationStatus.PENDING,
        lastError: 'provider_http_503',
        availableAt: expect.any(Date),
      }),
    }));
    expect(prisma.notificationDeliveryAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ errorCode: 'provider_http_503' }),
    }));
  });

  it('repairs latest provider status when a duplicate webhook event is replayed', async () => {
    prisma.notificationOutbox.findFirst.mockResolvedValue({ id: 'outbox-duplicate-event' });
    prisma.notificationDeliveryEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.0',
      }),
    );
    prisma.notificationOutbox.updateMany.mockResolvedValue({ count: 1 });
    const service = new NotificationOutboxService(prisma as never);

    await expect(service.recordProviderStatus(
      NotificationChannel.EMAIL,
      'resend',
      'resend-id',
      'delivered',
      'event-duplicate',
      new Date('2026-11-06T00:00:00Z'),
    )).resolves.toEqual({ recorded: false, reason: 'duplicate_event' });
    expect(prisma.notificationOutbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { providerStatus: 'delivered', providerStatusAt: new Date('2026-11-06T00:00:00Z') },
    }));
  });

  it('requeues a dead notification with an audit event and eight additional attempts', async () => {
    prisma.notificationOutbox.findUnique.mockResolvedValue({
      id: 'outbox-dead',
      status: NotificationStatus.DEAD,
    });
    const tx = {
      notificationOutbox: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      notificationDeliveryEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementationOnce((work: (client: unknown) => unknown) => work(tx) as never);
    const service = new NotificationOutboxService(prisma as never);

    await expect(service.retryDeadNotification('outbox-dead', 'admin-1')).resolves.toEqual({
      queued: true,
      notificationId: 'outbox-dead',
    });
    expect(tx.notificationOutbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'outbox-dead', status: NotificationStatus.DEAD },
      data: expect.objectContaining({
        status: NotificationStatus.PENDING,
        maxAttempts: { increment: 8 },
      }),
    }));
    expect(tx.notificationDeliveryEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: 'admin',
        status: 'manual_retry_requested',
        metadata: { actorId: 'admin-1' },
      }),
    }));
  });

  it('records provider webhook events idempotently', async () => {
    prisma.notificationOutbox.findFirst.mockResolvedValue({ id: 'outbox-3' });
    prisma.notificationDeliveryEvent.create.mockResolvedValue({});
    prisma.notificationOutbox.updateMany.mockResolvedValue({ count: 1 });
    const service = new NotificationOutboxService(prisma as never);

    await expect(service.recordProviderStatus(
      NotificationChannel.EMAIL,
      'resend',
      'email-provider-id',
      'delivered',
      'svix-event-1',
      new Date('2026-11-06T00:00:00Z'),
    )).resolves.toEqual({ recorded: true });

    expect(prisma.notificationDeliveryEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ providerEventId: 'svix-event-1', status: 'delivered' }),
    }));
  });


  it('marks a provider-accepted delivery ABANDONED when the worker has lost its lease', async () => {
    const notification = {
      id: 'outbox-lost-lease',
      channel: NotificationChannel.WHATSAPP,
      recipient: '201000000000',
      payload: { orderNumber: 'MES-LEASE', customerName: 'Test', customerPhone: '0100', total: '245', currency: 'EGP', items: 'Shirt', address: 'Cairo' },
      dedupeKey: 'order-lease:ORDER_CREATED:WHATSAPP',
      attempts: 1,
      maxAttempts: 8,
      lockToken: 'lease-current',
    };
    prisma.notificationOutbox.findUnique.mockResolvedValue(notification);
    prisma.notificationDeliveryAttempt.create.mockResolvedValue({ id: 'attempt-lost-lease' });
    prisma.notificationOutbox.updateMany.mockResolvedValue({ count: 0 });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.lease-accepted' }] }),
    }) as never;
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_ORDER_TEMPLATE_NAME = 'order_alert';
    process.env.WHATSAPP_API_VERSION = 'v99.0';

    const service = new NotificationOutboxService(prisma as never);
    await (service as any).processOne(notification.id, 'lease-current');

    expect(prisma.notificationOutbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: notification.id, status: NotificationStatus.PROCESSING, lockToken: 'lease-current' },
      data: expect.objectContaining({ status: NotificationStatus.SENT, payload: {}, recipient: null }),
    }));
    expect(prisma.notificationDeliveryAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'attempt-lost-lease' },
      data: expect.objectContaining({
        status: NotificationAttemptStatus.ABANDONED,
        errorCode: 'worker_lease_lost_after_delivery',
      }),
    }));
  });

  it('scrubs recipient and customer payload after successful delivery', async () => {
    const notification = {
      id: 'outbox-pii-scrub',
      channel: NotificationChannel.WHATSAPP,
      recipient: '201000000000',
      payload: { orderNumber: 'MES-PII', customerName: 'Test', customerPhone: '0100', total: '245', currency: 'EGP', items: 'Shirt', address: 'Cairo' },
      dedupeKey: 'order-pii:ORDER_CREATED:WHATSAPP',
      attempts: 1,
      maxAttempts: 8,
      lockToken: 'lease-pii',
    };
    prisma.notificationOutbox.findUnique.mockResolvedValue(notification);
    prisma.notificationDeliveryAttempt.create.mockResolvedValue({ id: 'attempt-pii-scrub' });
    prisma.notificationOutbox.updateMany.mockResolvedValue({ count: 1 });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.pii-scrubbed' }] }),
    }) as never;
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_ORDER_TEMPLATE_NAME = 'order_alert';
    process.env.WHATSAPP_API_VERSION = 'v99.0';

    const service = new NotificationOutboxService(prisma as never);
    await (service as any).processOne(notification.id, 'lease-pii');

    expect(prisma.notificationOutbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: NotificationStatus.SENT,
        payload: {},
        recipient: null,
        lockedAt: null,
        lockToken: null,
      }),
    }));
    expect(prisma.notificationDeliveryAttempt.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'attempt-pii-scrub' },
      data: expect.objectContaining({ status: NotificationAttemptStatus.SUCCEEDED }),
    }));
  });

});
