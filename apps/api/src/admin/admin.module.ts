import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuditInterceptor],
})
export class AdminModule {}
