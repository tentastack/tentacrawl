import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_METRIC_RECORDER,
  SCRAPE_QUEUE,
  SCRAPE_QUEUE_CONCURRENCY,
} from '@tentacrawl/core';
import type { QueueMetricRecorder } from '@tentacrawl/core';
import { scrapePayloadSchema } from '../data/schemas';
import { ScrapeExecutorService } from './scrape-executor.service';

@Processor(SCRAPE_QUEUE, { concurrency: SCRAPE_QUEUE_CONCURRENCY })
export class ScrapeProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(
    private readonly executor: ScrapeExecutorService,
    @Optional()
    @Inject(QUEUE_METRIC_RECORDER)
    private readonly queueMetricRecorder?: QueueMetricRecorder,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const startedAt = Date.now();
    let state: 'completed' | 'failed' = 'completed';

    this.queueMetricRecorder?.recordJobStart(SCRAPE_QUEUE);

    const parsed = scrapePayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      this.logger.error(`Invalid scrape payload for ${job.id}: ${parsed.error.message}`);
      this.queueMetricRecorder?.recordJobCompletion(SCRAPE_QUEUE, state, Date.now() - startedAt);
      return;
    }

    this.logger.log(
      `Processing scrape ${parsed.data.taskId} (url=${parsed.data.url}, attempt=${job.attemptsMade + 1})`,
    );

    try {
      await this.executor.execute(parsed.data);
    } catch (error: unknown) {
      state = 'failed';
      throw error;
    } finally {
      this.queueMetricRecorder?.recordJobCompletion(SCRAPE_QUEUE, state, Date.now() - startedAt);
    }
  }
}
