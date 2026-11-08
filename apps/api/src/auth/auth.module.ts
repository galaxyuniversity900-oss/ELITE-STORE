import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { DistributedRateLimitGuard } from './distributed-rate-limit.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard, DistributedRateLimitGuard],
  exports: [AuthService, AuthGuard, RolesGuard, DistributedRateLimitGuard],
})
export class AuthModule {}
