import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type AuthRequest = {
  ip?: string;
  path?: string;
  originalUrl?: string;
  body?: { email?: unknown };
  socket?: { remoteAddress?: string };
};
type AuthResponse = { setHeader(name: string, value: string): void };
type BucketRow = { count: number; resetAt: Date };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private checks = 0;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context.switchToHttp().getResponse<AuthResponse>();
    const path = request.path ?? request.originalUrl ?? '';
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const client = this.digest(ip);
    const now = Date.now();

    if (path.endsWith('/login')) {
      const email = typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase().slice(0, 254)
        : 'invalid';
      const identity = this.digest(ip + '\u0000' + email);
      const ipResult = await this.consume('login:ip:' + client, 30, 15 * 60 * 1000, now);
      const identityResult = await this.consume('login:identity:' + identity, 5, 15 * 60 * 1000, now);
      this.sweepIfNeeded(now);
      if (!ipResult.allowed || !identityResult.allowed) {
        const resetAt = Math.max(ipResult.allowed ? 0 : ipResult.resetAt, identityResult.allowed ? 0 : identityResult.resetAt);
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - now) / 1000))));
        throw new HttpException('Too many authentication attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    }

    if (path.endsWith('/register')) {
      const result = await this.consume('register:ip:' + client, 3, 60 * 60 * 1000, now);
      this.sweepIfNeeded(now);
      if (!result.allowed) {
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - now) / 1000))));
        throw new HttpException('Too many registration attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    return true;
  }

  private async consume(key: string, limit: number, windowMs: number, now: number) {
    const resetAt = new Date(now + windowMs);
    const nowDate = new Date(now);
    const query = [
      'INSERT INTO "api_rate_limit_buckets" ("id", "count", "resetAt", "updatedAt")',
      'VALUES ($1, 1, $2, NOW())',
      'ON CONFLICT ("id") DO UPDATE SET',
      '"count" = CASE WHEN "api_rate_limit_buckets"."resetAt" <= $3 THEN 1 ELSE "api_rate_limit_buckets"."count" + 1 END,',
      '"resetAt" = CASE WHEN "api_rate_limit_buckets"."resetAt" <= $3 THEN $4 ELSE "api_rate_limit_buckets"."resetAt" END,',
      '"updatedAt" = NOW()',
      'RETURNING "count", "resetAt"',
    ].join('\n');
    const rows = await this.prisma.$queryRawUnsafe<BucketRow[]>(query, key, resetAt, nowDate, resetAt);
    const row = rows[0];
    if (!row) throw new Error('Rate-limit storage returned no bucket');
    return { allowed: row.count <= limit, resetAt: row.resetAt.getTime() };
  }

  private sweepIfNeeded(now: number) {
    this.checks += 1;
    if (this.checks % 256 !== 0) return;
    void this.prisma.apiRateLimitBucket.deleteMany({
      where: { resetAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
    }).catch(() => undefined);
  }

  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
