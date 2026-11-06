import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DemoCommerceController } from './demo-commerce.controller';
import { DemoCommerceService } from './demo-commerce.service';
import { DemoCommerceGuard } from './demo-commerce.guard';

@Module({
  imports: [PrismaModule],
  controllers: [DemoCommerceController],
  providers: [DemoCommerceService, DemoCommerceGuard],
})
export class DemoCommerceModule {}
