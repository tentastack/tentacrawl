import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  CRAWL_PAGE_QUEUE,
  CRAWL_PAGE_QUEUE_CONCURRENCY,
  QUEUE_METRIC_RECORDER,
} from '@tentacrawl/core';
import type { QueueMetricRecorder } from '@tentacrawl/core';
import { crawlPagePayloadSchema } from '../data/schemas';
import { CrawlOrchestratorService } from './crawl-orchestrator.service';
import { CrawlPageExecutorService } from './crawl-page-executor.service';

@Processor(CRAWL_PAGE_QUEUE, { concurrency: CRAWL_PAGE_QUEUE_CONCURRENCY })
export class CrawlPageProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlPageProcessor.name);

  constructor(
    private readonly orchestrator: CrawlOrchestratorService,
    private readonly pageExecutor: CrawlPageExecutorService,
    @Optional()
    @Inject(QUEUE_METRIC_RECORDER)
    private readonly queueMetricRecorder?: QueueMetricRecorder,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const startedAt = Date.now();
    let state: 'completed' | 'failed' = 'completed';

    this.queueMetricRecorder?.recordJobStart(CRAWL_PAGE_QUEUE);

    const parsed = crawlPagePayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      this.logger.error(`Invalid page payload for ${job.id}: ${parsed.error.message}`);
      this.queueMetricRecorder?.recordJobCompletion(CRAWL_PAGE_QUEUE, state, Date.now() - startedAt);
      return;
    }

    const payload = parsed.data;
    this.logger.log(
      `Processing crawl page ${payload.pageId} (crawl=${payload.crawlId}, depth=${payload.depth}, attempt=${job.attemptsMade + 1})`,
    );

    try {
      const result = await this.pageExecutor.execute(payload);
      const resolvedPayload = result.finalUrl ? { ...payload, url: result.finalUrl } : payload;

      if (result.discoveredUrls.length > 0) {
        await this.orchestrator.onPageComplete(
          resolvedPayload.crawlId,
          result.discoveredUrls,
          resolvedPayload.depth,
          resolvedPayload,
        );
        return;
      }

      await this.orchestrator.checkCompletion(resolvedPayload.crawlId);
    } catch (error: unknown) {
      state = 'failed';
      throw error;
    } finally {
      this.queueMetricRecorder?.recordJobCompletion(CRAWL_PAGE_QUEUE, state, Date.now() - startedAt);
    }
  }
}