import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  NotificationAttemptStatus,
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type OrderSnapshot = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  grandTotal: { toString(): string } | string | number;
  currency: string;
  shippingAddress: Prisma.JsonValue;
  items: Array<{ productName: string; sku: string; quantity: number }>;
};

type OutboxPayload = Record<string, unknown>;

class DeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly httpStatus?: number,
  ) {
    super(code);
  }
}

@Injectable()
export class NotificationOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processBatch(), 5_000);
    this.timer.unref?.();
    void this.processBatch();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Must be called with the same Prisma transaction that creates the order.
   * The unique dedupe key makes repeated enqueue calls harmless.
   */
  async enqueueOrderCreated(tx: Prisma.TransactionClient, order: OrderSnapshot) {
    const address = this.asRecord(order.shippingAddress);
    const addressText = [address.city, address.area, address.street, address.building, address.apartment]
      .filter((value) => typeof value === 'string' && value.trim())
      .join('، ');
    const itemsText = order.items
      .map((item) => `${item.productName} × ${item.quantity} [${item.sku}]`)
      .join('، ')
      .slice(0, 900);
    const total = String(order.grandTotal);
    const whatsappRecipient = process.env.WHATSAPP_ORDER_RECIPIENT?.replace(/\D/g, '') || null;
    const emailRecipient = process.env.ORDER_NOTIFICATION_EMAIL?.trim() || null;

    const whatsappPayload: OutboxPayload = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      total,
      currency: order.currency,
      items: itemsText || 'لا توجد تفاصيل منتجات',
      address: addressText || 'راجع عنوان التوصيل',
    };
    const emailPayload: OutboxPayload = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      total,
      currency: order.currency,
      items: order.items.map((item) => ({
        name: item.productName,
        sku: item.sku,
        quantity: item.quantity,
      })),
      address: addressText,
      subject: `طلب جديد ${order.orderNumber} — MES STORE`,
    };

    return tx.notificationOutbox.createMany({
      data: [
        {
          orderId: order.id,
          channel: NotificationChannel.WHATSAPP,
          eventType: 'ORDER_CREATED',
          dedupeKey: `${order.id}:ORDER_CREATED:WHATSAPP`,
          recipient: whatsappRecipient,
          payload: whatsappPayload as Prisma.InputJsonValue,
        },
        {
          orderId: order.id,
          channel: NotificationChannel.EMAIL,
          eventType: 'ORDER_CREATED',
          dedupeKey: `${order.id}:ORDER_CREATED:EMAIL`,
          recipient: emailRecipient,
          payload: emailPayload as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });
  }

  async processBatch() {
    if (this.running) return;
    this.running = true;
    try {
      await this.recoverExpiredLeases();
      const due = await this.prisma.notificationOutbox.findMany({
        where: {
          status: NotificationStatus.PENDING,
          availableAt: { lte: new Date() },
        },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
        take: 10,
        select: { id: true },
      });
      for (const item of due) {
        await this.processOne(item.id);
      }
    } catch (error) {
      this.logger.error('Notification outbox batch failed', this.safeError(error));
    } finally {
      this.running = false;
    }
  }

  async getMetrics(windowMinutes = 60) {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const [queueGroups, attemptGroups, oldestPending] = await Promise.all([
      this.prisma.notificationOutbox.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.notificationDeliveryAttempt.groupBy({
        by: ['status'],
        where: { startedAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.notificationOutbox.findFirst({
        where: { status: NotificationStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const queueCounts = Object.fromEntries(
      queueGroups.map((group) => [group.status, group._count._all]),
    ) as Record<string, number>;
    const attemptCounts = Object.fromEntries(
      attemptGroups.map((group) => [group.status, group._count._all]),
    ) as Record<string, number>;

    const pending = queueCounts[NotificationStatus.PENDING] ?? 0;
    const processing = queueCounts[NotificationStatus.PROCESSING] ?? 0;
    const sent = queueCounts[NotificationStatus.SENT] ?? 0;
    const dead = queueCounts[NotificationStatus.DEAD] ?? 0;
    const succeeded = attemptCounts[NotificationAttemptStatus.SUCCEEDED] ?? 0;
    const failed = attemptCounts[NotificationAttemptStatus.FAILED] ?? 0;
    const completedAttempts = succeeded + failed;
    const failureRatePercent = completedAttempts
      ? Number(((failed / completedAttempts) * 100).toFixed(2))
      : 0;
    const alerts: Array<{ code: string; severity: 'warning' | 'critical'; count?: number; message: string }> = [];

    if (dead > 0) {
      alerts.push({
        code: 'dead_notifications',
        severity: 'critical',
        count: dead,
        message: 'There are notifications in terminal failure state.',
      });
    }
    if (pending > 0 && oldestPending?.createdAt) {
      const oldestAgeMinutes = (Date.now() - oldestPending.createdAt.getTime()) / 60000;
      if (oldestAgeMinutes >= 10) {
        alerts.push({
          code: 'pending_backlog',
          severity: 'warning',
          count: pending,
          message: 'The oldest pending notification has been queued for at least 10 minutes.',
        });
      }
    }
    if (completedAttempts >= 10 && failureRatePercent >= 10) {
      alerts.push({
        code: 'elevated_failure_rate',
        severity: 'warning',
        count: failed,
        message: 'Provider delivery failures are elevated in the selected time window.',
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      queue: { total: pending + processing + sent + dead, pending, processing, sent, dead },
      delivery: { windowMinutes, attempts: completedAttempts, succeeded, failed, failureRatePercent },
      alerts,
    };
  }

  async retryDeadNotification(id: string, actorId: string) {
    const current = await this.prisma.notificationOutbox.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!current) throw new NotFoundException('Notification record not found');
    if (current.status !== NotificationStatus.DEAD) {
      throw new BadRequestException('Only dead notifications can be manually retried');
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationOutbox.updateMany({
        where: { id, status: NotificationStatus.DEAD },
        data: {
          status: NotificationStatus.PENDING,
          maxAttempts: { increment: 8 },
          availableAt: now,
          lastError: null,
          lockedAt: null,
          lockToken: null,
        },
      });
      if (updated.count !== 1) throw new BadRequestException('Notification state changed; refresh and retry');
      await tx.notificationDeliveryEvent.create({
        data: {
          notificationId: id,
          provider: 'admin',
          providerEventId: randomUUID(),
          status: 'manual_retry_requested',
          occurredAt: now,
          metadata: { actorId },
        },
      });
    });
    return { queued: true, notificationId: id };
  }

  async listForAdmin(page = 1, limit = 50, status?: NotificationStatus, channel?: NotificationChannel) {
    const where: Prisma.NotificationOutboxWhereInput = {
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationOutbox.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderId: true,
          channel: true,
          eventType: true,
          recipient: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          availableAt: true,
          sentAt: true,
          providerMessageId: true,
          providerStatus: true,
          providerStatusAt: true,
          lastError: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
          attemptsLog: {
            orderBy: { attemptNumber: 'desc' },
            select: {
              attemptNumber: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              providerMessageId: true,
              httpStatus: true,
              errorCode: true,
              errorMessage: true,
            },
          },
          deliveryEvents: {
            orderBy: { occurredAt: 'desc' },
            take: 10,
            select: { provider: true, status: true, occurredAt: true },
          },
        },
      }),
      this.prisma.notificationOutbox.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async recordProviderStatus(
    channel: NotificationChannel,
    provider: string,
    providerMessageId: string,
    status: string,
    providerEventId: string,
    occurredAt: Date,
    metadata?: Prisma.InputJsonValue,
  ) {
    const notification = await this.prisma.notificationOutbox.findFirst({
      where: { channel, providerMessageId },
      select: { id: true },
    });
    if (!notification) return { recorded: false, reason: 'message_not_found' };

    let duplicateEvent = false;
    try {
      await this.prisma.notificationDeliveryEvent.create({
        data: {
          notificationId: notification.id,
          provider,
          providerEventId,
          status,
          occurredAt,
          metadata,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        duplicateEvent = true;
      } else {
        throw error;
      }
    }

    // Also apply duplicate callbacks: the first request may have persisted the event
    // but failed before updating the denormalized latest provider status.
    await this.prisma.notificationOutbox.updateMany({
      where: {
        id: notification.id,
        OR: [{ providerStatusAt: null }, { providerStatusAt: { lte: occurredAt } }],
      },
      data: { providerStatus: status, providerStatusAt: occurredAt },
    });
    return duplicateEvent
      ? { recorded: false, reason: 'duplicate_event' }
      : { recorded: true };
  }

  private async recoverExpiredLeases() {
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
    const stale = await this.prisma.notificationOutbox.findMany({
      where: { status: NotificationStatus.PROCESSING, lockedAt: { lte: staleBefore } },
      select: { id: true },
      take: 50,
    });
    for (const item of stale) {
      const recovered = await this.prisma.notificationOutbox.updateMany({
        where: {
          id: item.id,
          status: NotificationStatus.PROCESSING,
          lockedAt: { lte: staleBefore },
        },
        data: {
          status: NotificationStatus.PENDING,
          lockedAt: null,
          lockToken: null,
          lastError: 'worker_lease_expired',
        },
      });
      if (recovered.count) {
        await this.prisma.notificationDeliveryAttempt.updateMany({
          where: { notificationId: item.id, status: NotificationAttemptStatus.STARTED },
          data: {
            status: NotificationAttemptStatus.ABANDONED,
            finishedAt: new Date(),
            errorCode: 'worker_lease_expired',
            errorMessage: 'Worker lease expired before completion',
          },
        });
      }
    }
  }

  private async processOne(id: string) {
    const now = new Date();
    const lockToken = randomUUID();
    const claimed = await this.prisma.notificationOutbox.updateMany({
      where: {
        id,
        status: NotificationStatus.PENDING,
        availableAt: { lte: now },
      },
      data: {
        status: NotificationStatus.PROCESSING,
        lockedAt: now,
        lockToken,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return;

    const notification = await this.prisma.notificationOutbox.findUnique({ where: { id } });
    if (!notification || notification.lockToken !== lockToken) return;

    const attempt = await this.prisma.notificationDeliveryAttempt.create({
      data: {
        notificationId: id,
        attemptNumber: notification.attempts,
        status: NotificationAttemptStatus.STARTED,
      },
    });

    try {
      const result = await this.deliver(
        notification.channel,
        notification.recipient,
        notification.payload as OutboxPayload,
        notification.dedupeKey,
      );
      const finishedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.notificationDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            status: NotificationAttemptStatus.SUCCEEDED,
            finishedAt,
            providerMessageId: result.messageId,
            httpStatus: result.httpStatus,
          },
        }),
        this.prisma.notificationOutbox.updateMany({
          where: { id, status: NotificationStatus.PROCESSING, lockToken },
          data: {
            status: NotificationStatus.SENT,
            sentAt: finishedAt,
            providerMessageId: result.messageId,
            providerStatus: 'accepted',
            providerStatusAt: null,
            lastError: null,
            lockedAt: null,
            lockToken: null,
          },
        }),
      ]);
    } catch (error) {
      const failure = error instanceof DeliveryError
        ? error
        : new DeliveryError('network_or_provider_error', true);
      const finishedAt = new Date();
      const exhausted = notification.attempts >= notification.maxAttempts;
      const dead = !failure.retryable || exhausted;
      const delayMs = Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.max(0, notification.attempts - 1)));
      await this.prisma.$transaction([
        this.prisma.notificationDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            status: NotificationAttemptStatus.FAILED,
            finishedAt,
            httpStatus: failure.httpStatus,
            errorCode: failure.code,
            errorMessage: failure.code,
          },
        }),
        this.prisma.notificationOutbox.updateMany({
          where: { id, status: NotificationStatus.PROCESSING, lockToken },
          data: {
            status: dead ? NotificationStatus.DEAD : NotificationStatus.PENDING,
            availableAt: dead ? notification.availableAt : new Date(Date.now() + delayMs),
            lastError: failure.code,
            lockedAt: null,
            lockToken: null,
          },
        }),
      ]);
    }
  }

  private async deliver(
    channel: NotificationChannel,
    recipient: string | null,
    payload: OutboxPayload,
    dedupeKey: string,
  ): Promise<{ messageId: string; httpStatus: number }> {
    const targetRecipient = recipient || (channel === NotificationChannel.WHATSAPP
      ? (process.env.WHATSAPP_ORDER_RECIPIENT ?? '201558309605').replace(/\D/g, '')
      : process.env.ORDER_NOTIFICATION_EMAIL?.trim() || null);
    if (!targetRecipient) throw new DeliveryError('recipient_not_configured', false);

    if (channel === NotificationChannel.WHATSAPP) {
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const templateName = process.env.WHATSAPP_ORDER_TEMPLATE_NAME;
      const apiVersion = process.env.WHATSAPP_API_VERSION;
      const language = process.env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE ?? 'ar';
      if (!phoneNumberId || !accessToken || !templateName || !apiVersion) {
        throw new DeliveryError('whatsapp_provider_not_configured', false);
      }
      const parameters = [
        payload.orderNumber,
        payload.customerName,
        payload.customerPhone,
        `${payload.total} ${payload.currency}`,
        payload.items,
        payload.address,
      ].map((value) => ({
        type: 'text',
        text: String(value ?? '').slice(0, 1024),
      }));
      return this.postProvider(
        `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
        {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: targetRecipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components: [{ type: 'body', parameters }],
          },
        },
        'messages',
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) throw new DeliveryError('email_provider_not_configured', false);
    const items = Array.isArray(payload.items)
      ? payload.items.map((item: any) => `<li>${this.escapeHtml(item.name)} × ${Number(item.quantity) || 0} — ${this.escapeHtml(item.sku)}</li>`).join('')
      : '';
    const address = this.escapeHtml(String(payload.address ?? ''));
    const html = [
      '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">',
      '<h2>طلب جديد من MES STORE</h2>',
      `<p>رقم الطلب: <strong>${this.escapeHtml(String(payload.orderNumber ?? ''))}</strong></p>`,
      `<p>العميل: ${this.escapeHtml(String(payload.customerName ?? ''))}</p>`,
      `<p>الهاتف: ${this.escapeHtml(String(payload.customerPhone ?? ''))}</p>`,
      `<p>الإجمالي: ${this.escapeHtml(String(payload.total ?? ''))} ${this.escapeHtml(String(payload.currency ?? 'EGP'))}</p>`,
      `<ul>${items}</ul><p>العنوان: ${address}</p></div>`,
    ].join('');
    return this.postProvider(
      'https://api.resend.com/emails',
      {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': dedupeKey,
      },
      {
        from,
        to: [targetRecipient],
        subject: String(payload.subject ?? 'New MES STORE order'),
        html,
      },
      'id',
    );
  }

  private async postProvider(
    url: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    messageIdPath: 'messages' | 'id',
  ) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new DeliveryError('provider_network_error', true);
    }
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new DeliveryError(`provider_http_${response.status}`, retryable, response.status);
    }
    const messageId = messageIdPath === 'messages'
      ? result?.messages?.[0]?.id
      : result?.id;
    if (typeof messageId !== 'string' || !messageId) {
      throw new DeliveryError('provider_acceptance_unconfirmed', true, response.status);
    }
    return { messageId, httpStatus: response.status };
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);
  }

  private safeError(error: unknown) {
    return error instanceof Error ? error.name : 'unknown_error';
  }
}
