import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CRAWL_ORCHESTRATOR_QUEUE, CRAWL_PAGE_QUEUE } from '@tentacrawl/core';
import { CrawlEntity, CrawlPageEntity } from '../data/entities';
import { CrawlOrchestratorProcessor } from './crawl-orchestrator.processor';
import { CrawlPageProcessor } from './crawl-page.processor';
import { CrawlOrchestratorService } from './crawl-orchestrator.service';
import { CrawlPageExecutorService } from './crawl-page-executor.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: CRAWL_ORCHESTRATOR_QUEUE }),
    BullModule.registerQueue({ name: CRAWL_PAGE_QUEUE }),
    MikroOrmModule.forFeature([CrawlEntity, CrawlPageEntity]),
  ],
  providers: [
    CrawlOrchestratorProcessor,
    CrawlPageProcessor,
    CrawlOrchestratorService,
    CrawlPageExecutorService,
  ],
})
export class CrawlerWorkerModule {}
