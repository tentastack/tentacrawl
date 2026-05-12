import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  CRAWL_ORCHESTRATOR_QUEUE,
  CRAWL_PAGE_QUEUE,
  SCRAPE_QUEUE,
} from '@tentacrawl/core';
import { ActivityLogEntity, WorkerInstanceEntity } from '../data/entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
    BullModule.registerQueue({ name: CRAWL_ORCHESTRATOR_QUEUE }),
    BullModule.registerQueue({ name: CRAWL_PAGE_QUEUE }),
    MikroOrmModule.forFeature([ActivityLogEntity, WorkerInstanceEntity]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminApiModule {}