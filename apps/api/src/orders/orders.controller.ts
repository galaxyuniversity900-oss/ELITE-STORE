import { BadRequestException, Body, Controller, Headers, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { DistributedRateLimitGuard } from '../auth/distributed-rate-limit.guard';
import { CheckoutDto } from './orders.dto';
import { AuthService } from '../auth/auth.service';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(DistributedRateLimitGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly auth: AuthService) {}

  @Post('checkout/:sessionId')
  async checkout(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() input: CheckoutDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const user = authorization?.startsWith('Bearer ') ? await this.auth.authenticate(authorization.slice(7)) : null;
    return this.orders.checkout(sessionId, idempotencyKey, input, user?.id);
  }
}
