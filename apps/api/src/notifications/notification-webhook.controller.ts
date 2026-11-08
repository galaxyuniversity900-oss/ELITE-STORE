import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  ServiceUnavailableException,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { NotificationOutboxService } from './notification-outbox.service';

type WhatsAppStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ code?: number; title?: string }>;
};

@Controller('notifications/webhooks')
export class NotificationWebhookController {
  constructor(private readonly outbox: NotificationOutboxService) {}

  @Get('whatsapp')
  verifyWhatsApp(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (mode !== 'subscribe' || !expected || !this.safeEqual(token ?? '', expected)) {
      throw new ForbiddenException('Webhook verification failed');
    }
    return challenge;
  }

  @Post('whatsapp')
  async receiveWhatsApp(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: any,
  ) {
    this.verifyMetaSignature(request.rawBody, signature);
    const statuses: WhatsAppStatus[] = [];
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        statuses.push(...(change?.value?.statuses ?? []));
      }
    }
    if (statuses.length > 100) throw new BadRequestException('Too many webhook status events');
    for (const item of statuses) {
      if (!item.id || !item.status) continue;
      const timestamp = item.timestamp === undefined ? Math.floor(Date.now() / 1000) : Number(item.timestamp);
      const nowSeconds = Date.now() / 1000;
      if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > nowSeconds + 300 || timestamp < nowSeconds - 7 * 24 * 60 * 60) {
        throw new UnauthorizedException('Expired or invalid WhatsApp webhook event timestamp');
      }
      const occurredAt = new Date(timestamp * 1000);
      const eventId = `${item.id}:${item.status}:${item.timestamp ?? occurredAt.getTime()}`;
      const metadata = item.errors?.length
        ? { errorCodes: item.errors.map((error) => error.code).filter(Boolean) }
        : undefined;
      const recorded = await this.outbox.recordProviderStatus(
        NotificationChannel.WHATSAPP,
        'whatsapp',
        item.id,
        item.status,
        eventId,
        occurredAt,
        metadata as Prisma.InputJsonValue | undefined,
      );
      if (!recorded.recorded && recorded.reason === 'message_not_found') {
        throw new ServiceUnavailableException('Notification message is not indexed yet; provider may retry');
      }
    }
    return { received: true };
  }

  @Post('resend')
  async receiveResend(
    @Req() request: RawBodyRequest<Request>,
    @Headers('svix-id') eventId: string | undefined,
    @Headers('svix-timestamp') timestamp: string | undefined,
    @Headers('svix-signature') signature: string | undefined,
    @Body() body: any,
  ) {
    this.verifyResendSignature(request.rawBody, eventId, timestamp, signature);
    const emailId = body?.data?.email_id ?? body?.data?.id;
    const eventType = String(body?.type ?? '');
    const statusMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.delivery_delayed': 'delivery_delayed',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.failed': 'failed',
    };
    const status = statusMap[eventType];
    if (typeof emailId !== 'string' || !status || !eventId) {
      throw new BadRequestException('Unsupported or malformed Resend event');
    }
    const eventTime = body?.created_at ? new Date(body.created_at) : new Date();
    const recorded = await this.outbox.recordProviderStatus(
      NotificationChannel.EMAIL,
      'resend',
      emailId,
      status,
      eventId,
      Number.isNaN(eventTime.getTime()) ? new Date() : eventTime,
      { eventType } as Prisma.InputJsonValue,
    );
    if (!recorded.recorded && recorded.reason === 'message_not_found') {
      throw new ServiceUnavailableException('Notification message is not indexed yet; provider may retry');
    }
    return { received: true };
  }

  private verifyMetaSignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!rawBody || !secret || !signature?.startsWith('sha256=')) {
      throw new UnauthorizedException('Invalid WhatsApp webhook signature');
    }
    const supplied = Buffer.from(signature.slice(7), 'hex');
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid WhatsApp webhook signature');
    }
  }

  private verifyResendSignature(
    rawBody: Buffer | undefined,
    eventId: string | undefined,
    timestamp: string | undefined,
    signature: string | undefined,
  ) {
    const configured = process.env.RESEND_WEBHOOK_SECRET;
    if (!rawBody || !configured || !eventId || !timestamp || !signature) {
      throw new UnauthorizedException('Invalid Resend webhook signature');
    }
    const seconds = Number(timestamp);
    if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
      throw new UnauthorizedException('Expired Resend webhook timestamp');
    }
    const secret = configured.startsWith('whsec_')
      ? Buffer.from(configured.slice(6), 'base64')
      : Buffer.from(configured, 'utf8');
    const expected = createHmac('sha256', secret)
      .update(`${eventId}.${timestamp}.${rawBody.toString('utf8')}`)
      .digest('base64');
    const valid = signature.split(' ').some((part) => {
      const [version, value] = part.split(',');
      if (version !== 'v1' || !value) return false;
      return this.safeEqual(value, expected);
    });
    if (!valid) throw new UnauthorizedException('Invalid Resend webhook signature');
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
