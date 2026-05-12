import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  CRAWL_ORCHESTRATOR_QUEUE,
  CRAWL_PAGE_QUEUE,
  QUEUE_METRIC_RECORDER,
  SCRAPE_QUEUE,
} from '@tentacrawl/core';
import { MetricController } from './metric.controller';
import { MetricService } from './metric.service';
import { QueueMetricRecorderService } from './queue-metric-recorder.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
    BullModule.registerQueue({ name: CRAWL_ORCHESTRATOR_QUEUE }),
    BullModule.registerQueue({ name: CRAWL_PAGE_QUEUE }),
  ],
  controllers: [MetricController],
  providers: [
    MetricService,
    QueueMetricRecorderService,
    {
      provide: QUEUE_METRIC_RECORDER,
      useExisting: QueueMetricRecorderService,
    },
  ],
  exports: [MetricService, QueueMetricRecorderService, QUEUE_METRIC_RECORDER],
})
export class MetricModule {}
