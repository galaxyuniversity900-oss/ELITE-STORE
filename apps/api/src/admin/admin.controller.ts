import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { CreateProductDto, CreateProductVariantDto, UpdateOrderStatusDto, UpdateProductDto, UpdateProductVariantDto } from './admin.dto';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() { return this.admin.overview(); }

  @Get('products')
  products(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.admin.listProducts(this.page(page), this.limit(limit));
  }

  @Post('products')
  createProduct(@Body() input: CreateProductDto) { return this.admin.createProduct(input); }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() input: UpdateProductDto) {
    return this.admin.updateProduct(id, input);
  }

  @Delete('products/:id')
  archiveProduct(@Param('id') id: string) { return this.admin.archiveProduct(id); }


  @Get('products/:id/variants')
  productVariants(@Param('id') id: string) {
    return this.admin.listProductVariants(id);
  }

  @Post('products/:id/variants')
  createProductVariant(@Param('id') id: string, @Body() input: CreateProductVariantDto) {
    return this.admin.createProductVariant(id, input);
  }

  @Patch('product-variants/:id')
  updateProductVariant(@Param('id') id: string, @Body() input: UpdateProductVariantDto) {
    return this.admin.updateProductVariant(id, input);
  }

  @Delete('product-variants/:id')
  archiveProductVariant(@Param('id') id: string) {
    return this.admin.archiveProductVariant(id);
  }

  @Get('orders')
  orders(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.admin.listOrders(this.page(page), this.limit(limit));
  }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body() input: UpdateOrderStatusDto) {
    return this.admin.updateOrderStatus(id, input.status as OrderStatus);
  }

  private page(value: string) { return Math.max(1, Number.parseInt(value, 10) || 1); }
  private limit(value: string) { return Math.min(100, Math.max(1, Number.parseInt(value, 10) || 50)); }
}
