import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Counter, Gauge, Histogram } from 'prom-client';
import {
  CRAWL_ORCHESTRATOR_QUEUE,
  CRAWL_ORCHESTRATOR_QUEUE_CONCURRENCY,
  CRAWL_PAGE_QUEUE,
  CRAWL_PAGE_QUEUE_CONCURRENCY,
  SCRAPE_QUEUE,
  SCRAPE_QUEUE_CONCURRENCY,
} from '@tentacrawl/core';
import type { QueueJobTerminalState, QueueMetricRecorder } from '@tentacrawl/core';
import { MetricService } from './metric.service';

const QUEUE_METRIC_POLL_INTERVAL_MS = 10_000;

@Injectable()
export class QueueMetricRecorderService implements QueueMetricRecorder, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricRecorderService.name);
  private readonly queueDepthGauge: Gauge<'queue' | 'state'>;
  private readonly queueConcurrencyGauge: Gauge<'queue'>;
  private readonly queueJobStartedCounter: Counter<'queue'>;
  private readonly queueJobCompletedCounter: Counter<'queue' | 'state'>;
  private readonly queueJobDurationHistogram: Histogram<'queue' | 'state'>;
  private pollTimer?: NodeJS.Timeout;

  constructor(
    metricService: MetricService,
    @InjectQueue(SCRAPE_QUEUE) private readonly scrapeQueue: Queue,
    @InjectQueue(CRAWL_ORCHESTRATOR_QUEUE)
    private readonly crawlOrchestratorQueue: Queue,
    @InjectQueue(CRAWL_PAGE_QUEUE)
    private readonly crawlPageQueue: Queue,
  ) {
    const registry = metricService.getRegistry();

    this.queueDepthGauge = new Gauge({
      name: 'tentacrawl_queue_jobs',
      help: 'Current BullMQ job counts by queue and state.',
      labelNames: ['queue', 'state'],
      registers: [registry],
    });

    this.queueConcurrencyGauge = new Gauge({
      name: 'tentacrawl_queue_configured_concurrency',
      help: 'Configured worker concurrency by queue.',
      labelNames: ['queue'],
      registers: [registry],
    });

    this.queueJobStartedCounter = new Counter({
      name: 'tentacrawl_queue_jobs_started_total',
      help: 'Total number of queue jobs started by this worker instance.',
      labelNames: ['queue'],
      registers: [registry],
    });

    this.queueJobCompletedCounter = new Counter({
      name: 'tentacrawl_queue_jobs_completed_total',
      help: 'Total number of queue jobs completed by terminal state.',
      labelNames: ['queue', 'state'],
      registers: [registry],
    });

    this.queueJobDurationHistogram = new Histogram({
      name: 'tentacrawl_queue_job_duration_seconds',
      help: 'Observed queue job duration in seconds by queue and terminal state.',
      labelNames: ['queue', 'state'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [registry],
    });
  }

  async onModuleInit(): Promise<void> {
    this.setConfiguredConcurrency();
    await this.refreshQueueDepth().catch((error: unknown) => {
      this.logger.warn(`Initial queue metric refresh failed: ${String(error)}`);
    });

    this.pollTimer = setInterval(() => {
      void this.refreshQueueDepth().catch((error: unknown) => {
        this.logger.warn(`Queue metric refresh failed: ${String(error)}`);
      });
    }, QUEUE_METRIC_POLL_INTERVAL_MS);
    this.pollTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  recordJobStart(queueName: string): void {
    this.queueJobStartedCounter.inc({ queue: queueName });
  }

  recordJobCompletion(
    queueName: string,
    state: QueueJobTerminalState,
    durationMs: number,
  ): void {
    this.queueJobCompletedCounter.inc({ queue: queueName, state });
    this.queueJobDurationHistogram.observe(
      { queue: queueName, state },
      Math.max(durationMs, 0) / 1000,
    );
  }

  private setConfiguredConcurrency(): void {
    this.queueConcurrencyGauge.set({ queue: SCRAPE_QUEUE }, SCRAPE_QUEUE_CONCURRENCY);
    this.queueConcurrencyGauge.set(
      { queue: CRAWL_ORCHESTRATOR_QUEUE },
      CRAWL_ORCHESTRATOR_QUEUE_CONCURRENCY,
    );
    this.queueConcurrencyGauge.set({ queue: CRAWL_PAGE_QUEUE }, CRAWL_PAGE_QUEUE_CONCURRENCY);
  }

  private async refreshQueueDepth(): Promise<void> {
    const snapshots = await Promise.all([
      this.scrapeQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.crawlOrchestratorQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.crawlPageQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ]);

    this.updateQueueDepthGauge(SCRAPE_QUEUE, snapshots[0]);
    this.updateQueueDepthGauge(CRAWL_ORCHESTRATOR_QUEUE, snapshots[1]);
    this.updateQueueDepthGauge(CRAWL_PAGE_QUEUE, snapshots[2]);
  }

  private updateQueueDepthGauge(
    queueName: string,
    counts: Partial<Record<'waiting' | 'active' | 'completed' | 'failed' | 'delayed', number>>,
  ): void {
    this.queueDepthGauge.set({ queue: queueName, state: 'waiting' }, counts.waiting ?? 0);
    this.queueDepthGauge.set({ queue: queueName, state: 'active' }, counts.active ?? 0);
    this.queueDepthGauge.set({ queue: queueName, state: 'completed' }, counts.completed ?? 0);
    this.queueDepthGauge.set({ queue: queueName, state: 'failed' }, counts.failed ?? 0);
    this.queueDepthGauge.set({ queue: queueName, state: 'delayed' }, counts.delayed ?? 0);
  }
}