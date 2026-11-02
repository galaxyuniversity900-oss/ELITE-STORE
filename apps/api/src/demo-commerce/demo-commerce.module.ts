import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DemoCommerceController } from './demo-commerce.controller';
import { DemoCommerceService } from './demo-commerce.service';

@Module({
  imports: [PrismaModule],
  controllers: [DemoCommerceController],
  providers: [DemoCommerceService],
})
export class DemoCommerceModule {}
