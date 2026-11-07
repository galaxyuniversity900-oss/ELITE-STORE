import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';

type Bucket = { count: number; resetAt: number };

/**
 * Process-local protection for public credential endpoints.
 * Production deployments with multiple API replicas must also enforce a shared
 * edge/API-gateway rate limit; this guard is a defence-in-depth layer.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxRequests = 10;
  private readonly maxBuckets = 10_000;

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const key = `${request.path}:${ip}`;
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (this.buckets.size >= this.maxBuckets) {
        for (const [existingKey, existing] of this.buckets) {
          if (existing.resetAt <= now) this.buckets.delete(existingKey);
        }
        if (this.buckets.size >= this.maxBuckets) {
          const oldestKey = this.buckets.keys().next().value;
          if (oldestKey) this.buckets.delete(oldestKey);
        }
      }
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > this.maxRequests) {
      throw new HttpException('Too many authentication attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
