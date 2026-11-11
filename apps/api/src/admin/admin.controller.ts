import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { CreateContentPageDto, CreateEditorialCollectionDto, CreateProductDto, EditorialCollectionItemDto, UpdateContentPageDto, UpdateEditorialCollectionDto, UpdateOrderStatusDto, UpdateProductDto } from './admin.dto';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}


  @Get('content/pages')
  contentPages() { return this.admin.listContentPages(); }

  @Post('content/pages')
  createContentPage(@Body() input: CreateContentPageDto) { return this.admin.createContentPage(input); }

  @Patch('content/pages/:id')
  updateContentPage(@Param('id') id: string, @Body() input: UpdateContentPageDto) {
    return this.admin.updateContentPage(id, input);
  }

  @Get('editorial/collections')
  editorialCollections() { return this.admin.listEditorialCollections(); }

  @Post('editorial/collections')
  createEditorialCollection(@Body() input: CreateEditorialCollectionDto) {
    return this.admin.createEditorialCollection(input);
  }

  @Patch('editorial/collections/:id')
  updateEditorialCollection(@Param('id') id: string, @Body() input: UpdateEditorialCollectionDto) {
    return this.admin.updateEditorialCollection(id, input);
  }

  @Post('editorial/collections/:id/products')
  addEditorialProduct(@Param('id') id: string, @Body() input: EditorialCollectionItemDto) {
    return this.admin.addEditorialCollectionItem(id, input);
  }

  @Delete('editorial/collections/:id/products/:productId')
  removeEditorialProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.admin.removeEditorialCollectionItem(id, productId);
  }

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
