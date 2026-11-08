import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, catchError, from, map, mergeMap, of, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

type AuditRequest = {
  method?: string;
  originalUrl?: string;
  baseUrl?: string;
  route?: { path?: string };
  params?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  user?: { id?: string };
};

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    const method = String(request.method ?? 'GET').toUpperCase();
    const route = (request.baseUrl ?? '') + (request.route?.path ?? request.originalUrl?.split('?')[0] ?? '');
    const actorId = request.user?.id;
    if (!actorId || !route.startsWith('/api/admin') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const requestIdHeader = request.headers?.['x-request-id'];
    const requestId = (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader)?.slice(0, 128);
    const resourceId = request.params?.id?.slice(0, 128) ?? null;
    const resourceType = route.includes('/products') ? 'product'
      : route.includes('/orders') ? 'order'
      : 'admin_resource';
    const metadata = { bodyKeys: Object.keys(request.body ?? {}).slice(0, 40) } as Prisma.InputJsonValue;
    const write = (statusCode: number) => this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: (method + ' ' + route).slice(0, 255),
        resourceType,
        resourceId,
        method,
        route: route.slice(0, 500),
        statusCode,
        requestId,
        metadata,
      },
      select: { id: true },
    });

    return next.handle().pipe(
      mergeMap((result) => from(write(response.statusCode ?? 200)).pipe(
        map(() => result),
        catchError(() => of(result)),
      )),
      catchError((error: unknown) => from(write(
        typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
          ? error.status
          : 500,
      ).catch(() => null)).pipe(mergeMap(() => throwError(() => error)))),
    );
  }
}
