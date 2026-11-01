import { Module } from '@nestjs/common';
import { CartModule } from './cart/cart.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [PrismaModule, ProductsModule, CartModule],
  controllers: [HealthController],
})
export class AppModule {}
