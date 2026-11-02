import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DemoCommerceModule } from './demo-commerce/demo-commerce.module';
import { CartModule } from './cart/cart.module';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [PrismaModule, AuthModule, AdminModule, ProductsModule, CartModule, OrdersModule, DemoCommerceModule],
  controllers: [HealthController],
})
export class AppModule {}
