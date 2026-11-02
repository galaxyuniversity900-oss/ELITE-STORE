import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CheckoutDto } from './orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout/:sessionId')
  checkout(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() input: CheckoutDto,
  ) {
    return this.orders.checkout(sessionId, input);
  }
}
