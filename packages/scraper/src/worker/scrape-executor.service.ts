import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import { CHALLENGER_DISPATCHER } from '@tentacrawl/core';
import { extractUrlHostname } from '@tentacrawl/core/url';
import { ACTIVITY_LOG_RECORDER } from '@tentacrawl/core/activity';
import { NOTIFICATION_PUBLISHER } from '@tentacrawl/core/notification';
import type { ArtefactFormat, RunOutcome } from '@tentacrawl/core';
import type { ActivityLogRecorder } from '@tentacrawl/core/activity';
import type { NotificationPublisher } from '@tentacrawl/core/notification';
import { parseAndCompile } from '@tentacrawl/dsl';
import {
  createHardenedContext,
  collectArtefacts,
  instrumentPage,
  navigateWithChallenger,
  runDsl,
  type ChallengerDispatcher,
  type ChallengerRunSeed,
  type ChallengerRunSession,
  type RunnerOptions,
  type ContextOptions,
} from '@tentacrawl/browser';
import type { ScrapePayload, ScrapeResult } from '../data/schemas';
import { ScrapeEntity } from '../data/entities';

@Injectable()
export class ScrapeExecutorService {
  private readonly logger = new Logger(ScrapeExecutorService.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(CHALLENGER_DISPATCHER)
    private readonly dispatcher: ChallengerDispatcher,
    @Inject(ACTIVITY_LOG_RECORDER)
    private readonly activityLogRecorder: ActivityLogRecorder,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notificationPublisher: NotificationPublisher,
  ) {}

  async execute(payload: ScrapePayload): Promise<void> {
    const { taskId, url } = payload;
    const start = Date.now();
    const workerId = `worker-${process.pid}`;

    this.logger.log(`Executing scrape ${taskId}: ${url}`);
    await this.markProcessing(taskId);
    await this.activityLogRecorder.record({
      eventType: 'scrape.run.started',
      source: 'scraper',
      severity: 'info',
      title: 'Scrape execution started',
      message: `Scrape execution started for ${url}`,
      entityType: 'scrape',
      entityId: taskId,
      correlationId: taskId,
      workerId,
      metadata: { url },
    });

    const hostname = extractUrlHostname(url).toLowerCase();
    const origin = this.resolveOrigin(url, hostname);
    const seed: ChallengerRunSeed = {
      taskId,
      taskType: 'scrape',
      workerId,
      source: payload.dslYaml ? 'dsl-runner' : 'scrape-simple',
      correlationId: taskId,
      hostname,
      origin,
      initialUrl: url,
      networkPolicy: payload.networkPolicy,
    };

    const session = await this.dispatcher.beginRun(seed);
    let result: ScrapeResult;
    let runError: Error | undefined;

    try {
      if (payload.dslYaml) {
        result = await this.executeDsl(payload, session, workerId);
      } else {
        result = await this.executeSimple(payload, session, workerId);
      }
    } catch (err: unknown) {
      runError = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Scrape ${taskId} failed: ${runError.message}`);
      result = {
        outcome: 'ERROR',
        artefacts: {},
        durationMs: Date.now() - start,
        error: runError.message,
      };
    } finally {
      result ??= { outcome: 'ERROR', artefacts: {}, durationMs: Date.now() - start };
      const finalOutcome = await this.finalizeRun(session, result, runError);
      result.outcome = finalOutcome;
    }

    result.durationMs = Date.now() - start;
    await this.saveResult(taskId, result);
    await this.activityLogRecorder.record({
      eventType: result.outcome === 'OK' ? 'scrape.run.completed' : 'scrape.run.failed',
      source: 'scraper',
      severity: result.outcome === 'OK' ? 'success' : 'error',
      title: result.outcome === 'OK' ? 'Scrape execution completed' : 'Scrape execution failed',
      message: result.outcome === 'OK'
        ? `Scrape execution completed for ${url}`
        : `Scrape execution failed for ${url}: ${result.error ?? 'Unknown error'}`,
      entityType: 'scrape',
      entityId: taskId,
      correlationId: taskId,
      workerId,
      metadata: {
        url,
        durationMs: result.durationMs,
        outcome: result.outcome,
      },
    });
    await this.notificationPublisher.publish({
      eventType: result.outcome === 'OK' ? 'scrape.completed' : 'scrape.failed',
      source: 'scraper',
      severity: result.outcome === 'OK' ? 'success' : 'error',
      title: result.outcome === 'OK' ? 'Scrape completed' : 'Scrape failed',
      message: result.outcome === 'OK'
        ? url
        : `Scrape failed for ${url}: ${result.error ?? 'Unknown error'}`,
      entityType: 'scrape',
      entityId: taskId,
      correlationId: taskId,
      workerId,
      metadata: {
        url,
        durationMs: result.durationMs,
        outcome: result.outcome,
      },
    });
  }

  private async finalizeRun(
    session: ChallengerRunSession,
    result: ScrapeResult,
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

  private async executeSimple(
    payload: ScrapePayload,
    session: ChallengerRunSession,
    workerId: string,
  ): Promise<ScrapeResult> {
    const start = Date.now();

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
      await instrumentPage(page, session, 'scrape-simple');

      const { response, aborted } = await navigateWithChallenger(
        page,
        payload.url,
        {
          timeout: payload.timeout,
          waitUntil: payload.waitFor as 'load' | 'domcontentloaded' | 'networkidle',
        },
        session,
        'scrape-simple',
      );

      if (aborted) {
        return {
          outcome: 'BLOCKED',
          artefacts: {},
          env,
          durationMs: Date.now() - start,
          error: `Navigation aborted by challenger: ${aborted.reason ?? 'no reason'}`,
        };
      }

      const statusCode = response?.status() ?? 0;
      if (statusCode >= 400) {
        return {
          outcome: statusCode === 403 || statusCode === 429 ? 'BLOCKED' : 'ERROR',
          artefacts: {},
          env,
          httpStatus: statusCode,
          durationMs: Date.now() - start,
          error: `HTTP ${statusCode}`,
        };
      }

      const artefacts = await collectArtefacts(
        page,
        payload.artefacts as ArtefactFormat[],
        payload.url,
        session,
      );

      return {
        outcome: 'OK',
        artefacts,
        env,
        httpStatus: statusCode || undefined,
        durationMs: Date.now() - start,
      };
    } finally {
      await context.close().catch(() => {});
    }
  }

  private resolveOrigin(url: string, hostname: string): string {
    try {
      return new URL(url).origin;
    } catch {
      return `https://${hostname}`;
    }
  }

  private async executeDsl(
    payload: ScrapePayload,
    session: ChallengerRunSession,
    workerId: string,
  ): Promise<ScrapeResult> {
    const start = Date.now();
    const compiled = parseAndCompile(payload.dslYaml!, {
      params: { url: payload.url },
      actions: session.getActions(),
    });

    const runnerOpts: RunnerOptions = {
      workerId,
      jobId: payload.taskId,
      session,
    };
    if (payload.networkPolicy.mode === 'static') {
      runnerOpts.proxy = payload.networkPolicy.proxy;
    }

    const dslResult = await runDsl(compiled, runnerOpts);

    return {
      outcome: dslResult.status,
      artefacts: {
        extracted: dslResult.artifacts,
      },
      trace: dslResult.trace,
      env: {
        workerId,
        userAgent: dslResult.env.userAgent,
        viewport: dslResult.env.viewport,
        proxyServer: dslResult.env.proxyServer,
      },
      durationMs: Date.now() - start,
    };
  }

  private async markProcessing(taskId: string): Promise<void> {
    await this.em.nativeUpdate(ScrapeEntity, { id: taskId }, { status: 'PROCESSING' });
  }

  private async saveResult(taskId: string, result: ScrapeResult): Promise<void> {
    const entity = await this.em.findOneOrFail(ScrapeEntity, { id: taskId });
    entity.result = result;
    entity.durationMs = result.durationMs;
    entity.status = result.outcome === 'OK' ? 'COMPLETED' : 'FAILED';
    entity.error = result.error;
    entity.completedAt = new Date();
    await this.em.flush();
  }
}
