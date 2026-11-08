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

export function isCommerceSimulationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV !== 'production' || env.ENABLE_COMMERCE_SIMULATION === 'true';
}

// Simulated payment and courier adapters are for local development only.
// Production must never expose routes that can mark a simulated payment as paid
// or create a shipment that does not exist with a carrier.
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
