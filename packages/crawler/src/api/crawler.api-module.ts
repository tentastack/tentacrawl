import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CRAWL_ORCHESTRATOR_QUEUE } from '@tentacrawl/core';
import { CrawlEntity, CrawlPageEntity } from '../data/entities';
import { CrawlController } from './crawl.controller';
import { CrawlService } from './crawl.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: CRAWL_ORCHESTRATOR_QUEUE }),
    MikroOrmModule.forFeature([CrawlEntity, CrawlPageEntity]),
  ],
  controllers: [CrawlController],
  providers: [CrawlService],
  exports: [CrawlService],
})
export class CrawlerApiModule {}
