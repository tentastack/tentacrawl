import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import { CHALLENGER_DISPATCHER } from '@tentacrawl/core';
import { extractUrlHostname } from '@tentacrawl/core/url';
import { ACTIVITY_LOG_RECORDER } from '@tentacrawl/core/activity';
import type { ArtefactFormat, RunOutcome } from '@tentacrawl/core';
import type { ActivityLogRecorder } from '@tentacrawl/core/activity';
import {
  createHardenedContext,
  collectArtefacts,
  discoverLinks,
  instrumentPage,
  navigateWithChallenger,
  normalizeDiscoveredUrl,
} from '@tentacrawl/browser';
import type {
  ChallengerDispatcher,
  ChallengerRunSeed,
  ChallengerRunSession,
  ContextOptions,
} from '@tentacrawl/browser';
import { CrawlEntity, CrawlPageEntity } from '../data/entities';
import type { CrawlPagePayload, CrawlPageResult } from '../data/schemas';

@Injectable()
export class CrawlPageExecutorService {
  private readonly logger = new Logger(CrawlPageExecutorService.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(CHALLENGER_DISPATCHER)
    private readonly dispatcher: ChallengerDispatcher,
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

    const hostname = extractUrlHostname(url).toLowerCase();
    const origin = this.resolveOrigin(url, hostname);
    const seed: ChallengerRunSeed = {
      taskId: pageId,
      taskType: 'crawl-page',
      workerId,
      source: 'crawl-page',
      correlationId: crawlId,
      hostname,
      origin,
      initialUrl: url,
      networkPolicy: payload.networkPolicy,
    };

    const session = await this.dispatcher.beginRun(seed);
    let result: CrawlPageResult;
    let runError: Error | undefined;

    try {
      const contextOpts: ContextOptions = {
        locale: payload.locale,
        timezone: payload.timezone,
        headers: payload.headers,
      };
      if (payload.networkPolicy.mode === 'static') {
        contextOpts.proxy = payload.networkPolicy.proxy;
      }

      const { context, stealth } = await createHardenedContext(contextOpts, session);

      const env = {
        workerId,
        userAgent: stealth.userAgent,
        viewport: `${stealth.viewport.width}x${stealth.viewport.height}`,
        proxyServer: session.ctx.proxy?.server ?? contextOpts.proxy?.server,
      };

      try {
        const page = await context.newPage();
        await instrumentPage(page, session, 'crawl-page');

        const { response, aborted } = await navigateWithChallenger(
          page,
          url,
          {
            timeout: payload.timeout,
            waitUntil: payload.waitFor as 'load' | 'domcontentloaded' | 'networkidle',
          },
          session,
          'crawl-page',
        );
        const finalUrl = normalizeDiscoveredUrl(page.url()) ?? normalizeDiscoveredUrl(url) ?? url;

        if (aborted) {
          result = {
            outcome: 'BLOCKED',
            artefacts: {},
            env,
            durationMs: Date.now() - start,
            error: `Navigation aborted by challenger: ${aborted.reason ?? 'no reason'}`,
            finalUrl,
            discoveredUrls: [],
          };
        } else {
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
              session,
            );

            const allLinks = await discoverLinks(page, finalUrl, session);
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
        }
      } finally {
        await context.close().catch(() => {});
      }
    } catch (err: unknown) {
      runError = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Crawl ${crawlId} page ${pageId} failed: ${runError.message}`);
      result = {
        outcome: 'ERROR',
        artefacts: {},
        durationMs: Date.now() - start,
        error: runError.message,
        discoveredUrls: [],
      };
    } finally {
      result ??= {
        outcome: 'ERROR',
        artefacts: {},
        durationMs: Date.now() - start,
        discoveredUrls: [],
      };
      result.outcome = await this.finalizeRun(session, result, runError);
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

  private async finalizeRun(
    session: ChallengerRunSession,
    result: CrawlPageResult,
    error: Error | undefined,
  ): Promise<RunOutcome> {
    let outcome = result.outcome;
    try {
      const outcomeResult = await session.dispatch('run-outcome', {
        outcome,
        error: error?.message,
      });
      if (outcomeResult.outcomeOverride) {
        outcome = outcomeResult.outcomeOverride.status;
        result.error = result.error ?? outcomeResult.outcomeOverride.reason;
      }
      const appended = session.collectAppendedArtifacts();
      if (Object.keys(appended).length > 0) {
        result.artefacts = { ...result.artefacts, ...appended };
      }
    } catch (err) {
      this.logger.warn(`Challenger run-outcome dispatch failed: ${err}`);
    }
    await session.end(outcome, error);
    return outcome;
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
