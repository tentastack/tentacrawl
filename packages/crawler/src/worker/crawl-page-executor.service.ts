import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import {
  ModuleExtensionRegistry,
} from '@tentacrawl/core';
import { extractUrlHostname } from '@tentacrawl/core/url';
import { ACTIVITY_LOG_RECORDER } from '@tentacrawl/core/activity';
import type {
  RunHookContext,
  ArtefactFormat,
} from '@tentacrawl/core';
import type { ActivityLogRecorder } from '@tentacrawl/core/activity';
import {
  createHardenedContext,
  collectArtefacts,
  discoverLinks,
  normalizeDiscoveredUrl,
} from '@tentacrawl/browser';
import type { ContextOptions } from '@tentacrawl/browser';
import { CrawlEntity, CrawlPageEntity } from '../data/entities';
import type { CrawlPagePayload, CrawlPageResult } from '../data/schemas';

@Injectable()
export class CrawlPageExecutorService {
  private readonly logger = new Logger(CrawlPageExecutorService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly extensions: ModuleExtensionRegistry,
    @Inject(ACTIVITY_LOG_RECORDER)
    private readonly activityLogRecorder: ActivityLogRecorder,
  ) {}

  async execute(payload: CrawlPagePayload): Promise<CrawlPageResult> {
    const { crawlId, pageId, url } = payload;
    const start = Date.now();
    const workerId = `worker-${process.pid}`;

    this.logger.log(`Crawl ${crawlId}: processing page ${pageId} (${url}) depth=${payload.depth}`);

    const crawl = await this.em.findOneOrFail(CrawlEntity, { id: crawlId });
    if (crawl.status === 'CANCELLED') {
      this.logger.log(`Crawl ${crawlId} cancelled, skipping page ${pageId}`);
      const pageEntity = await this.em.findOneOrFail(CrawlPageEntity, { id: pageId });
      pageEntity.status = 'SKIPPED';
      pageEntity.completedAt = new Date();
      await this.em.flush();
      return {
        outcome: 'ERROR',
        artefacts: {},
        durationMs: Date.now() - start,
        error: 'Crawl cancelled',
        discoveredUrls: [],
      };
    }

    const pageEntity = await this.em.findOneOrFail(CrawlPageEntity, { id: pageId });
    pageEntity.status = 'PROCESSING';
    await this.em.flush();
    await this.activityLogRecorder.record({
      eventType: 'crawl.page.started',
      source: 'crawler',
      severity: 'info',
      title: 'Crawl page started',
      message: `Processing page ${url}`,
      entityType: 'crawl-page',
      entityId: pageId,
      correlationId: crawlId,
      workerId,
      metadata: {
        crawlId,
        url,
        depth: payload.depth,
      },
    });

    const hooks = this.extensions.getHooks();
    const hostname = extractUrlHostname(url).toLowerCase();
    const origin = this.resolveOrigin(url, hostname);
    const hookCtx: RunHookContext = {
      taskId: pageId,
      taskType: 'crawl-page',
      correlationId: crawlId,
      workerId,
      hostname,
      origin,
      networkPolicy: payload.networkPolicy,
      hookData: new Map(),
    };

    let result: CrawlPageResult;

    try {
      for (const hook of hooks) {
        await hook.beforeRun?.(hookCtx);
      }

      const contextOpts: ContextOptions = {
        locale: payload.locale,
        timezone: payload.timezone,
        headers: payload.headers,
      };

      if (hookCtx.proxy) {
        contextOpts.proxy = hookCtx.proxy;
      } else if (payload.networkPolicy.mode === 'static') {
        contextOpts.proxy = payload.networkPolicy.proxy;
      }

      const { context, stealth } = await createHardenedContext(contextOpts);

      const env = {
        workerId,
        userAgent: stealth.userAgent,
        viewport: `${stealth.viewport.width}x${stealth.viewport.height}`,
        proxyServer: contextOpts.proxy?.server,
      };

      try {
        const page = await context.newPage();

        const response = await page.goto(url, {
          timeout: payload.timeout,
          waitUntil: payload.waitFor as 'load' | 'domcontentloaded' | 'networkidle',
        });
        const finalUrl = normalizeDiscoveredUrl(page.url()) ?? normalizeDiscoveredUrl(url) ?? url;

        const statusCode = response?.status() ?? 0;
        if (statusCode >= 400) {
          result = {
            outcome: statusCode === 403 || statusCode === 429 ? 'BLOCKED' : 'ERROR',
            artefacts: {},
            env,
            durationMs: Date.now() - start,
            httpStatus: statusCode,
            error: `HTTP ${statusCode}`,
            finalUrl,
            discoveredUrls: [],
          };
        } else {
          const artefacts = await collectArtefacts(
            page,
            payload.artefacts as ArtefactFormat[],
            finalUrl,
          );

          const allLinks = await discoverLinks(page, finalUrl);
          const internalUrls = allLinks
            .filter((l) => l.isInternal)
            .map((l) => l.url);

          result = {
            outcome: 'OK',
            artefacts,
            env,
            durationMs: Date.now() - start,
            finalUrl,
            discoveredUrls: internalUrls,
          };
        }
      } finally {
        await context.close().catch(() => {});
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Crawl ${crawlId} page ${pageId} failed: ${error}`);
      result = {
        outcome: 'ERROR',
        artefacts: {},
        durationMs: Date.now() - start,
        error,
        discoveredUrls: [],
      };
    } finally {
      for (const hook of hooks) {
        await hook.afterRun?.(hookCtx).catch((e: unknown) => {
          this.logger.warn(`afterRun hook error: ${e}`);
        });
      }
    }

    await this.savePageResult(crawlId, pageId, result);
    if (result.outcome !== 'OK') {
      await this.activityLogRecorder.record({
        eventType: 'crawl.page.failed',
        source: 'crawler',
        severity: 'error',
        title: 'Crawl page failed',
        message: `Page ${url} failed: ${result.error ?? 'Unknown error'}`,
        entityType: 'crawl-page',
        entityId: pageId,
        correlationId: crawlId,
        workerId,
        metadata: {
          crawlId,
          url,
          depth: payload.depth,
          durationMs: result.durationMs,
        },
      });
    }
    return result;
  }

  private async savePageResult(
    crawlId: string,
    pageId: string,
    result: CrawlPageResult,
  ): Promise<void> {
    const pageEntity = await this.em.findOneOrFail(CrawlPageEntity, { id: pageId });
    pageEntity.url = result.finalUrl ?? pageEntity.url;
    pageEntity.result = result;
    pageEntity.durationMs = result.durationMs;
    pageEntity.discoveredUrlCount = result.discoveredUrls.length;
    pageEntity.status = result.outcome === 'OK' ? 'COMPLETED' : 'FAILED';
    pageEntity.error = result.error;
    pageEntity.completedAt = new Date();
    await this.em.flush();

    const incField = result.outcome === 'OK' ? 'completedPages' : 'failedPages';
    await this.em.getCollection(CrawlEntity).updateOne(
      { _id: crawlId } as any,
      { $inc: { [incField]: 1 } },
    );
  }

  private resolveOrigin(url: string, hostname: string): string {
    try {
      return new URL(url).origin;
    } catch {
      return `https://${hostname}`;
    }
  }
}
