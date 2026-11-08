import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WhatsAppNotificationsService } from './whatsapp-notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService, WhatsAppNotificationsService],
})
export class OrdersModule {}
