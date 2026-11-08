import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { NotificationWebhookController } from './notification-webhook.controller';

describe('NotificationWebhookController', () => {
  const outbox = { recordProviderStatus: jest.fn() };
  let controller: NotificationWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotificationWebhookController(outbox as never);
    process.env.WHATSAPP_APP_SECRET = 'meta-test-secret';
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from('resend-test-secret').toString('base64')}`;
  });

  it('accepts a correctly signed Meta webhook and records message delivery status', async () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            statuses: [{ id: 'wamid.123', status: 'delivered', timestamp: '1793923200' }],
          },
        }],
      }],
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
      .update(rawBody)
      .digest('hex')}`;
    outbox.recordProviderStatus.mockResolvedValue({ recorded: true });

    await expect(controller.receiveWhatsApp({ rawBody } as never, signature, body)).resolves.toEqual({ received: true });
    expect(outbox.recordProviderStatus).toHaveBeenCalledWith(
      NotificationChannel.WHATSAPP,
      'whatsapp',
      'wamid.123',
      'delivered',
      'wamid.123:delivered:1793923200',
      new Date(1793923200 * 1000),
      undefined,
    );
  });

  it('rejects an invalid Meta webhook signature', async () => {
    const body = { entry: [] };
    await expect(controller.receiveWhatsApp(
      { rawBody: Buffer.from(JSON.stringify(body)) } as never,
      'sha256=invalid',
      body,
    )).rejects.toBeInstanceOf(UnauthorizedException);
    expect(outbox.recordProviderStatus).not.toHaveBeenCalled();
  });

  it('returns a retryable error when a provider callback races message ID persistence', async () => {
    const body = {
      entry: [{
        changes: [{
          value: { statuses: [{ id: 'wamid.not-indexed', status: 'sent', timestamp: '1793923200' }] },
        }],
      }],
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
      .update(rawBody)
      .digest('hex')}`;
    outbox.recordProviderStatus.mockResolvedValue({ recorded: false, reason: 'message_not_found' });

    await expect(controller.receiveWhatsApp({ rawBody } as never, signature, body))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('verifies Resend Svix signatures before recording delivered events', async () => {
    const body = {
      type: 'email.delivered',
      created_at: '2026-11-06T04:00:00.000Z',
      data: { email_id: 'resend-email-123' },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const eventId = 'evt_resend_123';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const secret = Buffer.from('resend-test-secret');
    const signature = createHmac('sha256', secret)
      .update(`${eventId}.${timestamp}.${rawBody.toString('utf8')}`)
      .digest('base64');
    outbox.recordProviderStatus.mockResolvedValue({ recorded: true });

    await expect(controller.receiveResend(
      { rawBody } as never,
      eventId,
      timestamp,
      `v1,${signature}`,
      body,
    )).resolves.toEqual({ received: true });
    expect(outbox.recordProviderStatus).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      'resend',
      'resend-email-123',
      'delivered',
      eventId,
      new Date('2026-11-06T04:00:00.000Z'),
      { eventType: 'email.delivered' },
    );
  });

  it('rejects an invalid Resend signature', async () => {
    const body = { type: 'email.delivered', data: { email_id: 'resend-email-123' } };
    const rawBody = Buffer.from(JSON.stringify(body));
    await expect(controller.receiveResend(
      { rawBody } as never,
      'evt_invalid',
      String(Math.floor(Date.now() / 1000)),
      'v1,invalid',
      body,
    )).rejects.toBeInstanceOf(UnauthorizedException);
    expect(outbox.recordProviderStatus).not.toHaveBeenCalled();
  });
});
