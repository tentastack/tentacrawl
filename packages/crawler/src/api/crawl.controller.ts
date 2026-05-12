import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { createCrawlDto } from '../data/schemas';
import { CrawlService } from './crawl.service';

@Controller('crawl')
export class CrawlController {
  constructor(private readonly crawlService: CrawlService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async startCrawl(@Body() body: unknown) {
    const parsed = createCrawlDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.crawlService.createCrawl(parsed.data);
  }

  @Get()
  async listCrawls(
    @Query('status') status?: string,
    @Query('url') url?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.crawlService.listCrawls({
      status,
      url,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      sort: sort ?? 'createdAt',
      order: (order ?? 'desc') as 'asc' | 'desc',
    });
  }

  @Get(':id')
  async getCrawl(@Param('id') id: string) {
    try {
      return await this.crawlService.getCrawl(id);
    } catch {
      throw new NotFoundException(`Crawl ${id} not found`);
    }
  }

  @Get(':id/pages')
  async getCrawlPages(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('url') url?: string,
  ) {
    return this.crawlService.getCrawlPages(
      id,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      status,
      url,
    );
  }

  @Get(':id/pages/:pageId')
  async getCrawlPage(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
  ) {
    try {
      return await this.crawlService.getCrawlPage(id, pageId);
    } catch {
      throw new NotFoundException(`Crawl page ${pageId} not found in crawl ${id}`);
    }
  }

  @Delete(':id')
  async cancelCrawl(@Param('id') id: string) {
    try {
      return await this.crawlService.cancelCrawl(id);
    } catch {
      throw new NotFoundException(`Crawl ${id} not found`);
    }
  }
}
