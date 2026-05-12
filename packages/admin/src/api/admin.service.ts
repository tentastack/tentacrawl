import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EntityManager } from '@mikro-orm/mongodb';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  CRAWL_ORCHESTRATOR_QUEUE,
  CRAWL_ORCHESTRATOR_QUEUE_CONCURRENCY,
  CRAWL_PAGE_QUEUE,
  CRAWL_PAGE_QUEUE_CONCURRENCY,
  SCRAPE_QUEUE,
  SCRAPE_QUEUE_CONCURRENCY,
} from '@tentacrawl/core';
import { CrawlEntity } from '@tentacrawl/crawler';
import { ScrapeEntity } from '@tentacrawl/scraper';
import { loadAdminConfig } from '../config';
import { ActivityLogEntity, WorkerInstanceEntity } from '../data/entities';
import type {
  ActivityLogItem,
  ActivityLogListQuery,
  ActivityLogListResponse,
  DashboardOverview,
  QueueSnapshot,
  WorkerSummary,
} from '../data/schemas';

const DASHBOARD_QUEUE_TIMEOUT_MS = 1_500;

@Injectable()
export class AdminService {
  private readonly config;

  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
    @InjectQueue(SCRAPE_QUEUE) private readonly scrapeQueue: Queue,
    @InjectQueue(CRAWL_ORCHESTRATOR_QUEUE)
    private readonly crawlOrchestratorQueue: Queue,
    @InjectQueue(CRAWL_PAGE_QUEUE)
    private readonly crawlPageQueue: Queue,
  ) {
    this.config = loadAdminConfig(this.configService);
  }

  async getOverview(): Promise<DashboardOverview> {
    const [
      queues,
      scrapeCounts,
      crawlCounts,
      workers,
    ] = await Promise.all([
      this.getQueueSnapshots(),
      this.getScrapeCounts(),
      this.getCrawlCounts(),
      this.listWorkers(),
    ]);

    const activeJobs = queues.reduce((sum, queue) => sum + queue.waiting + queue.active, 0);
    const activeWorkers = workers.filter((worker) => worker.status === 'healthy').length;

    return {
      stats: {
        totalScrapes: scrapeCounts.total,
        totalCrawls: crawlCounts.total,
        activeJobs,
        activeWorkers,
      },
      queues,
    };
  }

  async listWorkers(): Promise<WorkerSummary[]> {
    const workers = await this.em.find(WorkerInstanceEntity, {}, { orderBy: { lastHeartbeatAt: 'DESC' } });

    return workers.map((worker) => {
      const freshnessMs = Date.now() - worker.lastHeartbeatAt.getTime();
      return {
        workerId: worker.workerId,
        hostname: worker.hostname,
        pid: worker.pid,
        port: worker.port,
        version: worker.version,
        startedAt: worker.startedAt.toISOString(),
        lastHeartbeatAt: worker.lastHeartbeatAt.toISOString(),
        supportedQueues: worker.supportedQueues,
        supportedModules: worker.supportedModules,
        status: this.getWorkerHealth(freshnessMs),
        freshnessMs,
        uptimeMs: Date.now() - worker.startedAt.getTime(),
      };
    });
  }

  async listActivity({
    limit = this.config.ADMIN_DASHBOARD_DEFAULT_LIST_LIMIT,
    offset = 0,
  }: Partial<ActivityLogListQuery> = {}): Promise<ActivityLogListResponse> {
    const resolvedLimit = Math.min(limit, 100);
    const [events, total] = await Promise.all([
      this.em.find(
        ActivityLogEntity,
        {},
        { orderBy: { createdAt: 'DESC' }, limit: resolvedLimit, offset },
      ),
      this.em.count(ActivityLogEntity, {}),
    ]);

    return {
      data: events.map((event) => this.toActivityLogItem(event)),
      total,
      limit: resolvedLimit,
      offset,
    };
  }

  private async getQueueSnapshots(): Promise<QueueSnapshot[]> {
    const [scrapeCounts, crawlOrchestratorCounts, crawlPageCounts] = await Promise.all([
      this.getQueueCountsWithFallback(this.scrapeQueue),
      this.getQueueCountsWithFallback(this.crawlOrchestratorQueue),
      this.getQueueCountsWithFallback(this.crawlPageQueue),
    ]);

    return [
      {
        id: 'scraper',
        label: 'Page scraper',
        concurrency: SCRAPE_QUEUE_CONCURRENCY,
        waiting: scrapeCounts.waiting ?? 0,
        active: scrapeCounts.active ?? 0,
        completed: scrapeCounts.completed ?? 0,
        failed: scrapeCounts.failed ?? 0,
        delayed: scrapeCounts.delayed ?? 0,
      },
      {
        id: 'crawl-orchestrator',
        label: 'Crawl orchestrator',
        concurrency: CRAWL_ORCHESTRATOR_QUEUE_CONCURRENCY,
        waiting: crawlOrchestratorCounts.waiting ?? 0,
        active: crawlOrchestratorCounts.active ?? 0,
        completed: crawlOrchestratorCounts.completed ?? 0,
        failed: crawlOrchestratorCounts.failed ?? 0,
        delayed: crawlOrchestratorCounts.delayed ?? 0,
      },
      {
        id: 'crawl-page',
        label: 'Crawl page executor',
        concurrency: CRAWL_PAGE_QUEUE_CONCURRENCY,
        waiting: crawlPageCounts.waiting ?? 0,
        active: crawlPageCounts.active ?? 0,
        completed: crawlPageCounts.completed ?? 0,
        failed: crawlPageCounts.failed ?? 0,
        delayed: crawlPageCounts.delayed ?? 0,
      },
    ];
  }

  private async getQueueCountsWithFallback(queue: Queue) {
    try {
      return await this.withTimeout(
        queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
        DASHBOARD_QUEUE_TIMEOUT_MS,
      );
    } catch {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async getScrapeCounts() {
    const [total, completed, failed] = await Promise.all([
      this.em.count(ScrapeEntity, {}),
      this.em.count(ScrapeEntity, { status: 'COMPLETED' }),
      this.em.count(ScrapeEntity, { status: 'FAILED' }),
    ]);

    return { total, completed, failed };
  }

  private async getCrawlCounts() {
    const [total, completed, failed] = await Promise.all([
      this.em.count(CrawlEntity, {}),
      this.em.count(CrawlEntity, { status: 'COMPLETED' }),
      this.em.count(CrawlEntity, { status: 'FAILED' }),
    ]);

    return { total, completed, failed };
  }

  private getWorkerHealth(freshnessMs: number): WorkerSummary['status'] {
    if (freshnessMs <= this.config.ADMIN_WORKER_HEALTHY_THRESHOLD_MS) {
      return 'healthy';
    }

    if (freshnessMs <= this.config.ADMIN_WORKER_STALE_THRESHOLD_MS) {
      return 'stale';
    }

    return 'offline';
  }

  private toActivityLogItem(event: ActivityLogEntity): ActivityLogItem {
    return {
      id: event.id,
      eventType: event.eventType,
      source: event.source,
      severity: event.severity,
      title: event.title,
      message: event.message,
      entityType: event.entityType,
      entityId: event.entityId,
      workerId: event.workerId,
      correlationId: event.correlationId,
      createdAt: event.createdAt.toISOString(),
    };
  }
}