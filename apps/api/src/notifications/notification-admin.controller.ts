import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { NotificationChannel, NotificationStatus, UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationOutboxService } from './notification-outbox.service';

@Controller('admin/notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class NotificationAdminController {
  constructor(private readonly outbox: NotificationOutboxService) {}

  @Get('metrics')
  metrics(@Query('windowMinutes') windowMinutes = '60') {
    const parsed = Number.parseInt(windowMinutes, 10) || 60;
    return this.outbox.getOperationalMetrics(parsed);
  }
  @Post(':id/retry')
  retry(@Param('id') id: string, @Req() request: Request & { user?: { id: string } }) {
    return this.outbox.retryDeadNotification(id, request.user?.id ?? 'unknown-admin');
  }

  @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('status') status?: NotificationStatus,
    @Query('channel') channel?: NotificationChannel,
  ) {
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const safeStatus = Object.values(NotificationStatus).includes(status as NotificationStatus)
      ? status
      : undefined;
    const safeChannel = Object.values(NotificationChannel).includes(channel as NotificationChannel)
      ? channel
      : undefined;
    return this.outbox.listForAdmin(safePage, safeLimit, safeStatus, safeChannel);
  }
}
