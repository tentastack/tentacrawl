import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { createScrapeDto } from '../data/schemas';
import { ScrapeService } from './scrape.service';

@Controller('scrape')
export class ScrapeController {
  constructor(private readonly scrapeService: ScrapeService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async scrape(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: { status(code: number): void },
  ) {
    const parsed = createScrapeDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const result = await this.scrapeService.createScrape(parsed.data);

    if (parsed.data.async && result.status === 'PENDING') {
      res.status(HttpStatus.ACCEPTED);
    }

    return result;
  }

  @Get()
  async listScrapes(
    @Query('status') status?: string,
    @Query('url') url?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.scrapeService.listScrapes({
      status,
      url,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      sort: sort ?? 'createdAt',
      order: (order ?? 'desc') as 'asc' | 'desc',
    });
  }

  @Get(':id')
  async getScrape(@Param('id') id: string) {
    try {
      return await this.scrapeService.getScrape(id);
    } catch {
      throw new NotFoundException(`Scrape ${id} not found`);
    }
  }
}
