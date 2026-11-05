import { CanActivate, ExecutionContext, Injectable, TooManyRequestsException } from '@nestjs/common';
import { createHash } from 'node:crypto';

type AuthRequest = {
  ip?: string;
  path?: string;
  originalUrl?: string;
  body?: { email?: unknown };
  socket?: { remoteAddress?: string };
};

type AuthResponse = { setHeader(name: string, value: string): void };
type Bucket = { count: number; resetAt: number };

/**
 * Process-local emergency protection for public authentication endpoints.
 *
 * Production deployments with multiple API replicas MUST also enforce a
 * shared limit at the reverse proxy/API gateway (or a shared Redis store).
 * This guard deliberately does not trust X-Forwarded-For.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private checks = 0;

  canActivate(context: ExecutionContext): boolean {
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
      const identity = this.digest(`${ip}\u0000${email}`);
      const ipResult = this.consume(`login:ip:${client}`, 30, 15 * 60 * 1000, now);
      const identityResult = this.consume(`login:identity:${identity}`, 5, 15 * 60 * 1000, now);
      this.sweepIfNeeded(now);

      if (!ipResult.allowed || !identityResult.allowed) {
        const resetAt = Math.max(
          ipResult.allowed ? 0 : ipResult.resetAt,
          identityResult.allowed ? 0 : identityResult.resetAt,
        );
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - now) / 1000))));
        throw new TooManyRequestsException('Too many authentication attempts. Try again later.');
      }
      return true;
    }

    if (path.endsWith('/register')) {
      const result = this.consume(`register:ip:${client}`, 3, 60 * 60 * 1000, now);
      this.sweepIfNeeded(now);
      if (!result.allowed) {
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - now) / 1000))));
        throw new TooManyRequestsException('Too many registration attempts. Try again later.');
      }
    }

    return true;
  }

  private consume(key: string, limit: number, windowMs: number, now: number) {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, next);
      return { allowed: true, resetAt: next.resetAt };
    }
    if (current.count >= limit) return { allowed: false, resetAt: current.resetAt };
    current.count += 1;
    return { allowed: true, resetAt: current.resetAt };
  }

  private sweepIfNeeded(now: number) {
    this.checks += 1;
    if (this.checks % 128 !== 0 && this.buckets.size < 10_000) return;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    while (this.buckets.size > 10_000) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) break;
      this.buckets.delete(oldest.value);
    }
  }

  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
