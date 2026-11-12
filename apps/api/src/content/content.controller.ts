import { Controller, Get, Param } from '@nestjs/common';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('pages/:slug')
  page(@Param('slug') slug: string) {
    return this.content.page(slug);
  }

  @Get('collections/:slug')
  collection(@Param('slug') slug: string) {
    return this.content.collection(slug);
  }
}
