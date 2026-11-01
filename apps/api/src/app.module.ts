import { Module } from '@nestjs/common';
import { CartModule } from './cart/cart.module';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [ProductsModule, CartModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
