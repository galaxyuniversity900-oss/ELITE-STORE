import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationAdminController } from './notification-admin.controller';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationWebhookController } from './notification-webhook.controller';

@Module({
  imports: [AuthModule],
  controllers: [NotificationAdminController, NotificationWebhookController],
  providers: [NotificationOutboxService],
  exports: [NotificationOutboxService],
})
export class NotificationsModule {}
