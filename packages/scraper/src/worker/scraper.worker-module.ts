import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SCRAPE_QUEUE } from '@tentacrawl/core';
import { ScrapeEntity } from '../data/entities';
import { ScrapeProcessor } from './scrape.processor';
import { ScrapeExecutorService } from './scrape-executor.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
    MikroOrmModule.forFeature([ScrapeEntity]),
  ],
  providers: [ScrapeProcessor, ScrapeExecutorService],
})
export class ScraperWorkerModule {}
