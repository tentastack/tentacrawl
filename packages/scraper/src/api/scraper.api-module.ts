import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SCRAPE_QUEUE } from '@tentacrawl/core';
import { ScrapeEntity } from '../data/entities';
import { ScrapeController } from './scrape.controller';
import { ScrapeService } from './scrape.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
    MikroOrmModule.forFeature([ScrapeEntity]),
  ],
  controllers: [ScrapeController],
  providers: [ScrapeService],
  exports: [ScrapeService],
})
export class ScraperApiModule {}
