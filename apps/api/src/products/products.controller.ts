import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query('page') page = '1', @Query('limit') limit = '24', @Query('category') category?: string, @Query('q') search?: string, @Query('sort') sort?: string) {
    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 24));
    const safeSort = sort === 'price_asc' || sort === 'price_desc' ? sort : 'newest';
    return this.products.list(pageNumber, pageSize, category, search, safeSort);
  }

  @Get(':slug')
  async bySlug(@Param('slug') slug: string) {
    const product = await this.products.bySlug(slug);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
