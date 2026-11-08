import { NotificationAttemptStatus, NotificationStatus } from '@prisma/client';
import { NotificationOutboxService } from './notification-outbox.service';

describe('NotificationOutboxService operational metrics', () => {
  it('calculates queue health, latency percentiles, failure rate and actionable alerts', async () => {
    const now = new Date();
    const prisma = {
      notificationOutbox: {
        count: jest.fn()
          .mockResolvedValueOnce(60)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(12)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(50)
          .mockResolvedValueOnce(1),
        findFirst: jest.fn().mockResolvedValue({
          createdAt: new Date(now.getTime() - 30 * 60_000),
        }),
      },
      notificationDeliveryAttempt: {
        count: jest.fn()
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(0),
        findMany: jest.fn().mockResolvedValue(
          Array.from({ length: 10 }, (_, index) => ({
            startedAt: new Date(now.getTime() - (index + 1) * 60_000),
            finishedAt: new Date(now.getTime() - (index + 1) * 60_000 + (index + 1) * 1_000),
            status: index < 8 ? NotificationAttemptStatus.SUCCEEDED : NotificationAttemptStatus.FAILED,
          })),
        ),
      },
    };
    process.env.OUTBOX_ALERT_PENDING_BACKLOG = '50';
    process.env.OUTBOX_ALERT_DEAD_COUNT = '1';
    process.env.OUTBOX_ALERT_FAILURE_RATE_PERCENT = '10';
    process.env.OUTBOX_ALERT_SEND_P95_MS = '5000';
    process.env.OUTBOX_ALERT_OLDEST_PENDING_SECONDS = '900';

    const service = new NotificationOutboxService(prisma as never);
    const metrics = await service.getOperationalMetrics(60);

    expect(metrics.queue).toEqual(expect.objectContaining({
      pending: 60,
      due: 50,
      processing: 1,
      sent: 12,
      dead: 2,
      staleProcessing: 1,
    }));
    expect(metrics.delivery.attempts).toBe(10);
    expect(metrics.delivery.failureRatePercent).toBe(20);
    expect(metrics.delivery.averageSendDurationMs).toBe(5500);
    expect(metrics.delivery.p95SendDurationMs).toBe(10000);
    expect(metrics.alerts.map((alert) => alert.code)).toEqual(expect.arrayContaining([
      'dead_letters_present',
      'pending_backlog_high',
      'oldest_pending_too_old',
      'stale_processing_lease',
      'failure_rate_high',
      'send_latency_p95_high',
    ]));
    expect(prisma.notificationOutbox.count).toHaveBeenCalledWith({
      where: { status: NotificationStatus.PENDING },
    });
  });

  it('clamps metrics window to supported bounds and reports zero rates with no attempts', async () => {
    const prisma = {
      notificationOutbox: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      notificationDeliveryAttempt: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new NotificationOutboxService(prisma as never);
    const metrics = await service.getOperationalMetrics(99999);
    expect(metrics.windowMinutes).toBe(1440);
    expect(metrics.delivery.failureRatePercent).toBe(0);
    expect(metrics.delivery.p95SendDurationMs).toBeNull();
    expect(metrics.alerts).toHaveLength(0);
  });
});
