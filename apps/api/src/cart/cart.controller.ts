import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AddCartItemDto, UpdateCartItemDto } from './cart.dto';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
  constructor(private readonly carts: CartService) {}

  @Get(':sessionId')
  get(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.carts.get(sessionId);
  }

  @Post(':sessionId/items')
  add(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() input: AddCartItemDto,
  ) {
    return this.carts.addItem(sessionId, input.productId, input.quantity);
  }

  @Patch(':sessionId/items/:itemId')
  update(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('itemId') itemId: string,
    @Body() input: UpdateCartItemDto,
  ) {
    return this.carts.updateQuantity(sessionId, itemId, input.quantity);
  }

  @Delete(':sessionId/items/:itemId')
  remove(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.carts.removeItem(sessionId, itemId);
  }
}
