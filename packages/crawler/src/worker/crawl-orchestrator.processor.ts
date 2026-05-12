import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  CRAWL_ORCHESTRATOR_QUEUE,
  CRAWL_ORCHESTRATOR_QUEUE_CONCURRENCY,
  QUEUE_METRIC_RECORDER,
} from '@tentacrawl/core';
import type { QueueMetricRecorder } from '@tentacrawl/core';
import { crawlOrchestratorPayloadSchema } from '../data/schemas';
import { CrawlOrchestratorService } from './crawl-orchestrator.service';

@Processor(CRAWL_ORCHESTRATOR_QUEUE, { concurrency: CRAWL_ORCHESTRATOR_QUEUE_CONCURRENCY })
export class CrawlOrchestratorProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlOrchestratorProcessor.name);

  constructor(
    private readonly orchestrator: CrawlOrchestratorService,
    @Optional()
    @Inject(QUEUE_METRIC_RECORDER)
    private readonly queueMetricRecorder?: QueueMetricRecorder,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const startedAt = Date.now();
    let state: 'completed' | 'failed' = 'completed';

    this.queueMetricRecorder?.recordJobStart(CRAWL_ORCHESTRATOR_QUEUE);

    const parsed = crawlOrchestratorPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      this.logger.error(`Invalid orchestrator payload for ${job.id}: ${parsed.error.message}`);
      this.queueMetricRecorder?.recordJobCompletion(
        CRAWL_ORCHESTRATOR_QUEUE,
        state,
        Date.now() - startedAt,
      );
      return;
    }

    this.logger.log(
      `Processing crawl orchestration ${parsed.data.crawlId} (url=${parsed.data.url}, attempt=${job.attemptsMade + 1})`,
    );

    try {
      await this.orchestrator.orchestrate(parsed.data);
    } catch (error: unknown) {
      state = 'failed';
      throw error;
    } finally {
      this.queueMetricRecorder?.recordJobCompletion(
        CRAWL_ORCHESTRATOR_QUEUE,
        state,
        Date.now() - startedAt,
      );
    }
  }
}