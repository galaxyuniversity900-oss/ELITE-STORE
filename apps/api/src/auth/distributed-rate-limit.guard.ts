import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type LimitRule = { limit: number; windowMs: number; label: string };
type RateLimitRow = { count: number; expiresAt: Date };

@Injectable()
export class DistributedRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(DistributedRateLimitGuard.name);
  private cleanupCounter = 0;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<{ setHeader(name: string, value: string): void }>();
    const route = request.method + ':' + request.baseUrl + (request.route?.path ?? request.path);
    const rule = this.ruleFor(route);
    if (!rule) return true;

    // Hash the source identifier so raw IP addresses are never persisted in the limiter table.
    // Express does not trust forwarded headers unless the deployment explicitly configures trust proxy.
    const source = request.ip || request.socket.remoteAddress || 'unknown';
    const hashSecret = process.env.JWT_SECRET;
    if (!hashSecret || Buffer.byteLength(hashSecret) < 32) throw new Error('JWT_SECRET must be configured before rate limiting');
    const key = createHmac('sha256', hashSecret).update(rule.label + '\0' + route + '\0' + source).digest('hex');
    const rows = await this.prisma.$queryRawUnsafe<RateLimitRow[]>(
      'INSERT INTO "api_rate_limit_buckets" ("key", "count", "windowStartedAt", "expiresAt") ' +
      'VALUES ($1, 1, NOW(), NOW() + ($2 * INTERVAL \'1 millisecond\')) ' +
      'ON CONFLICT ("key") DO UPDATE SET ' +
      '"count" = CASE WHEN "api_rate_limit_buckets"."expiresAt" <= NOW() THEN 1 ELSE "api_rate_limit_buckets"."count" + 1 END, ' +
      '"windowStartedAt" = CASE WHEN "api_rate_limit_buckets"."expiresAt" <= NOW() THEN NOW() ELSE "api_rate_limit_buckets"."windowStartedAt" END, ' +
      '"expiresAt" = CASE WHEN "api_rate_limit_buckets"."expiresAt" <= NOW() THEN NOW() + ($2 * INTERVAL \'1 millisecond\') ELSE "api_rate_limit_buckets"."expiresAt" END ' +
      'RETURNING "count", "expiresAt"',
      key,
      rule.windowMs,
    );
    const bucket = rows[0];
    if (!bucket) throw new Error('Rate limit bucket could not be persisted');

    if (bucket.count > rule.limit) {
      const retryAfter = Math.max(1, Math.ceil((new Date(bucket.expiresAt).getTime() - Date.now()) / 1000));
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Try again later.',
        retryAfterSeconds: retryAfter,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    this.cleanupCounter += 1;
    if (this.cleanupCounter >= 250) {
      this.cleanupCounter = 0;
      try {
        await this.prisma.$executeRawUnsafe(
          'DELETE FROM "api_rate_limit_buckets" WHERE "expiresAt" < NOW() - INTERVAL \'1 day\'',
        );
      } catch (error) {
        this.logger.warn('Expired rate-limit cleanup failed: ' + (error instanceof Error ? error.name : 'unknown_error'));
      }
    }
    return true;
  }

  private ruleFor(route: string): LimitRule | null {
    if (route.endsWith('POST:/api/auth/login') || route.endsWith('POST:/auth/login')) {
      return { limit: 10, windowMs: 15 * 60 * 1000, label: 'auth-login' };
    }
    if (route.endsWith('POST:/api/auth/register') || route.endsWith('POST:/auth/register')) {
      return { limit: 5, windowMs: 60 * 60 * 1000, label: 'auth-register' };
    }
    if (route.includes('POST:') && route.includes('/orders/checkout/')) {
      return { limit: 30, windowMs: 15 * 60 * 1000, label: 'checkout' };
    }
    if (route.includes('/notifications/webhooks/')) {
      return { limit: 300, windowMs: 60 * 1000, label: 'provider-webhook' };
    }
    return null;
  }
}
