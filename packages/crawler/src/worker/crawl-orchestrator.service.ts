import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EntityManager } from '@mikro-orm/mongodb';
import { Queue } from 'bullmq';
import {
  CRAWL_PAGE_QUEUE,
  CRAWL_PAGE_QUEUE_DEFAULT_OPTS,
} from '@tentacrawl/core';
import { ACTIVITY_LOG_RECORDER } from '@tentacrawl/core/activity';
import { NOTIFICATION_PUBLISHER } from '@tentacrawl/core/notification';
import type { ActivityLogRecorder } from '@tentacrawl/core/activity';
import type { NotificationPublisher } from '@tentacrawl/core/notification';
import { normalizeDiscoveredUrl } from '@tentacrawl/browser';
import { CrawlEntity, CrawlPageEntity } from '../data/entities';
import type {
  CrawlOrchestratorPayload,
  CrawlPagePayload,
} from '../data/schemas';

function buildCrawlPageJobId(crawlId: string, pageId: string) {
  return `${crawlId}--${pageId}`;
}

@Injectable()
export class CrawlOrchestratorService {
  private readonly logger = new Logger(CrawlOrchestratorService.name);

  constructor(
    private readonly em: EntityManager,
    @InjectQueue(CRAWL_PAGE_QUEUE) private readonly crawlPageQueue: Queue,
    @Inject(ACTIVITY_LOG_RECORDER)
    private readonly activityLogRecorder: ActivityLogRecorder,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notificationPublisher: NotificationPublisher,
  ) {}

  async orchestrate(payload: CrawlOrchestratorPayload): Promise<void> {
    const { crawlId, url } = payload;
    const normalizedSeedUrl = normalizeDiscoveredUrl(url) ?? url;
    this.logger.log(`Orchestrating crawl ${crawlId}: ${url}`);

    const crawl = await this.em.findOneOrFail(CrawlEntity, { id: crawlId });
    crawl.status = 'PROCESSING';

    let seedPage = await this.em.findOne(CrawlPageEntity, { crawlId, url: normalizedSeedUrl, depth: 0 });

    if (!seedPage) {
      seedPage = this.em.create(CrawlPageEntity, {
        crawlId,
        url: normalizedSeedUrl,
        depth: 0,
        status: 'PENDING',
      });
    }

    crawl.totalPages = Math.max(crawl.totalPages, 1);
    await this.em.flush();

    const pagePayload: CrawlPagePayload = {
      crawlId,
      pageId: seedPage.id,
      url: normalizedSeedUrl,
      depth: 0,
      artefacts: payload.artefacts,
      networkPolicy: payload.networkPolicy,
      timeout: payload.timeout,
      waitFor: payload.waitFor,
      locale: payload.locale,
      timezone: payload.timezone,
      headers: payload.headers,
      dslYaml: payload.dslYaml,
      maxDepth: payload.maxDepth,
      maxPages: payload.maxPages,
      includePattern: payload.includePattern,
      excludePattern: payload.excludePattern,
    };

    await this.crawlPageQueue.add('crawl-page', pagePayload, {
      ...CRAWL_PAGE_QUEUE_DEFAULT_OPTS,
      jobId: buildCrawlPageJobId(crawlId, seedPage.id),
    });

    await this.activityLogRecorder.record({
      eventType: 'crawl.run.started',
      source: 'crawler',
      severity: 'info',
      title: 'Crawl execution started',
      message: `Crawl execution started for ${url}`,
      entityType: 'crawl',
      entityId: crawlId,
      correlationId: crawlId,
      workerId: `worker-${process.pid}`,
      metadata: {
        url: normalizedSeedUrl,
        seedPageId: seedPage.id,
      },
    });

    this.logger.log(
      `Seed page enqueued for crawl ${crawlId}`,
    );
  }

  async onPageComplete(
    crawlId: string,
    discoveredUrls: string[],
    pageDepth: number,
    payload: CrawlPagePayload,
  ): Promise<void> {
    const crawl = await this.em.findOneOrFail(CrawlEntity, { id: crawlId });
    const normalizedCurrentPageUrl = normalizeDiscoveredUrl(payload.url) ?? payload.url;
    const normalizedDiscoveredUrls = [...new Set(discoveredUrls
      .map((entry) => normalizeDiscoveredUrl(entry))
      .filter((entry): entry is string => entry !== null)
      .filter((entry) => entry !== normalizedCurrentPageUrl))];

    if (crawl.status === 'CANCELLED') {
      this.logger.log(`Crawl ${crawlId} cancelled, skipping discovery`);
      return;
    }

    if (normalizedDiscoveredUrls.length === 0) {
      await this.checkCompletion(crawlId);
      return;
    }

    const existingPages = await this.em.find(
      CrawlPageEntity,
      { crawlId, url: { $in: normalizedDiscoveredUrls } },
      { fields: ['url'] as const },
    );
    const existingUrls = new Set(existingPages.map((p) => p.url));
    const nextDepth = pageDepth + 1;

    let newUrls = normalizedDiscoveredUrls.filter((entry) => !existingUrls.has(entry));

    if (payload.includePattern) {
      const include = new RegExp(payload.includePattern);
      newUrls = newUrls.filter((u) => include.test(u));
    }
    if (payload.excludePattern) {
      const exclude = new RegExp(payload.excludePattern);
      newUrls = newUrls.filter((u) => !exclude.test(u));
    }

    if (nextDepth > payload.maxDepth) {
      newUrls = [];
    }
    const remaining = payload.maxPages - crawl.totalPages;
    if (remaining <= 0) {
      newUrls = [];
    } else {
      newUrls = newUrls.slice(0, remaining);
    }

    const newPages: CrawlPageEntity[] = [];
    for (const url of newUrls) {
      const page = this.em.create(CrawlPageEntity, {
        crawlId,
        url,
        depth: nextDepth,
        status: 'PENDING',
      });
      newPages.push(page);
    }

    crawl.totalPages += newPages.length;
    await this.em.flush();

    if (newPages.length > 0) {
      const jobs = newPages.map((p) => {
        return {
          name: 'crawl-page',
          data: {
            crawlId,
            pageId: p.id,
            url: p.url,
            depth: nextDepth,
            artefacts: payload.artefacts,
            networkPolicy: payload.networkPolicy,
            timeout: payload.timeout,
            waitFor: payload.waitFor,
            locale: payload.locale,
            timezone: payload.timezone,
            headers: payload.headers,
            dslYaml: payload.dslYaml,
            maxDepth: payload.maxDepth,
            maxPages: payload.maxPages,
            includePattern: payload.includePattern,
            excludePattern: payload.excludePattern,
          } satisfies CrawlPagePayload,
          opts: {
            ...CRAWL_PAGE_QUEUE_DEFAULT_OPTS,
            jobId: buildCrawlPageJobId(crawlId, p.id),
          },
        };
      });

      await this.crawlPageQueue.addBulk(jobs);
      this.logger.log(
        `Enqueued ${newPages.length} new pages for crawl ${crawlId}`,
      );
    }

    await this.checkCompletion(crawlId);
  }

  async checkCompletion(crawlId: string): Promise<void> {
    const crawl = await this.em.findOneOrFail(CrawlEntity, { id: crawlId });
    const done = crawl.completedPages + crawl.failedPages;

    if (done >= crawl.totalPages && crawl.status === 'PROCESSING') {
      crawl.status = crawl.failedPages === crawl.totalPages ? 'FAILED' : 'COMPLETED';
      crawl.completedAt = new Date();
      await this.em.flush();
      await this.activityLogRecorder.record({
        eventType: crawl.status === 'COMPLETED' ? 'crawl.run.completed' : 'crawl.run.failed',
        source: 'crawler',
        severity: crawl.status === 'COMPLETED' ? 'success' : 'error',
        title: crawl.status === 'COMPLETED' ? 'Crawl execution completed' : 'Crawl execution failed',
        message: crawl.status === 'COMPLETED'
          ? `Crawl execution completed for ${crawl.url}`
          : `Crawl execution failed for ${crawl.url}`,
        entityType: 'crawl',
        entityId: crawlId,
        correlationId: crawlId,
        workerId: `worker-${process.pid}`,
        metadata: {
          url: crawl.url,
          totalPages: crawl.totalPages,
          completedPages: crawl.completedPages,
          failedPages: crawl.failedPages,
        },
      });
      await this.notificationPublisher.publish({
        eventType: crawl.status === 'COMPLETED' ? 'crawl.completed' : 'crawl.failed',
        source: 'crawler',
        severity: crawl.status === 'COMPLETED' ? 'success' : 'error',
        title: crawl.status === 'COMPLETED' ? 'Crawl completed' : 'Crawl failed',
        message: crawl.status === 'COMPLETED'
          ? crawl.url
          : `Crawl failed for ${crawl.url}`,
        entityType: 'crawl',
        entityId: crawlId,
        correlationId: crawlId,
        workerId: `worker-${process.pid}`,
        metadata: {
          url: crawl.url,
          totalPages: crawl.totalPages,
          completedPages: crawl.completedPages,
          failedPages: crawl.failedPages,
        },
      });
      this.logger.log(
        `Crawl ${crawlId} ${crawl.status}: ${crawl.completedPages}/${crawl.totalPages} pages`,
      );
    }
  }
}
