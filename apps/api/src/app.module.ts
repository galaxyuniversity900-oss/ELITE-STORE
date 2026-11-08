import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { DemoCommerceModule } from './demo-commerce/demo-commerce.module';
import { CartModule } from './cart/cart.module';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';

/**
 * Simulated payment/courier routes are never exposed in production.
 * A production environment variable must not be able to re-enable fake
 * payment confirmations or non-existent shipments.
 */
export function isCommerceSimulationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV !== 'production';
}

const commerceSimulationEnabled = isCommerceSimulationEnabled();

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AccountModule,
    AdminModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    ...(commerceSimulationEnabled ? [DemoCommerceModule] : []),
  ],
  controllers: [HealthController],
})
export class AppModule {}
