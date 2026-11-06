import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { DemoCommerceService } from './demo-commerce.service';
import { DemoCommerceGuard } from './demo-commerce.guard';

class DemoPaymentDto {
  @IsString() @MinLength(7) @MaxLength(30) phone!: string;
  @IsIn(['success', 'failed', 'pending']) outcome!: 'success' | 'failed' | 'pending';
}
class DemoShippingDto {
  @IsString() @MinLength(7) @MaxLength(30) phone!: string;
}
class DemoShipmentStatusDto extends DemoShippingDto {
  @IsIn(['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_ATTEMPT_FAILED']) status!: string;
  @IsString() @MaxLength(160) description!: string;
  @IsString() @MaxLength(100) location!: string;
}

@Controller('demo-commerce')
@UseGuards(DemoCommerceGuard)
export class DemoCommerceController {
  constructor(private readonly demo: DemoCommerceService) {}

  @Get('payment-methods')
  paymentMethods() { return this.demo.paymentMethods(); }

  @Get('shipping-options')
  shippingOptions() { return this.demo.shippingOptions(); }

  @Post('orders/:orderNumber/payment')
  simulatePayment(@Param('orderNumber') orderNumber: string, @Body() input: DemoPaymentDto) {
    return this.demo.simulatePayment(orderNumber, input);
  }

  @Post('orders/:orderNumber/dispatch')
  dispatch(@Param('orderNumber') orderNumber: string, @Body() input: DemoShippingDto) {
    return this.demo.dispatch(orderNumber, input.phone);
  }

  @Post('shipments/:trackingNumber/status')
  updateShipment(@Param('trackingNumber') trackingNumber: string, @Body() input: DemoShipmentStatusDto) {
    return this.demo.updateShipment(trackingNumber, input);
  }

  @Get('track/:trackingNumber')
  track(@Param('trackingNumber') trackingNumber: string, @Query('phone') phone: string) {
    return this.demo.track(trackingNumber, phone);
  }
}
