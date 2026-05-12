import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EntityManager } from '@mikro-orm/mongodb';
import { Queue, QueueEvents } from 'bullmq';
import {
  SCRAPE_QUEUE,
  SCRAPE_QUEUE_DEFAULT_OPTS,
} from '@tentacrawl/core';
import { extractUrlOrigin } from '@tentacrawl/core/url';
import { ScrapeEntity } from '../data/entities';
import type {
  CreateScrapeDto,
  ScrapeListItem,
  ScrapePayload,
  ScrapeResponse,
} from '../data/schemas';

const SYNC_TIMEOUT_MS = 60_000;

@Injectable()
export class ScrapeService {
  private readonly logger = new Logger(ScrapeService.name);

  constructor(
    private readonly em: EntityManager,
    @InjectQueue(SCRAPE_QUEUE) private readonly scrapeQueue: Queue,
  ) {}

  async createScrape(dto: CreateScrapeDto): Promise<ScrapeResponse> {
    const origin = extractUrlOrigin(dto.url);
    const entity = this.em.create(ScrapeEntity, {
      url: dto.url,
      origin,
      artefacts: [...dto.artefacts],
      status: 'PENDING',
      networkPolicy: dto.networkPolicy,
      timeout: dto.timeout,
      waitFor: dto.waitFor,
      locale: dto.locale,
      timezone: dto.timezone,
      headers: dto.headers,
      dslYaml: dto.dsl,
    });

    await this.em.flush();

    const payload: ScrapePayload = {
      taskId: entity.id,
      url: dto.url,
      artefacts: [...dto.artefacts],
      networkPolicy: dto.networkPolicy,
      timeout: dto.timeout,
      waitFor: dto.waitFor,
      locale: dto.locale,
      timezone: dto.timezone,
      headers: dto.headers,
      dslYaml: dto.dsl,
    };

    const bullJob = await this.scrapeQueue.add(
      'scrape',
      payload,
      {
        ...SCRAPE_QUEUE_DEFAULT_OPTS,
        jobId: entity.id,
      },
    );

    if (!dto.async) {
      return this.waitForCompletion(entity.id, bullJob.id!);
    }

    this.logger.log(`Scrape ${entity.id} enqueued (async)`);
    return this.toResponse(entity);
  }

  async getScrape(id: string): Promise<ScrapeResponse> {
    const entity = await this.em.findOneOrFail(ScrapeEntity, { id });
    return this.toResponse(entity);
  }

  async listScrapes(opts: {
    status?: string;
    url?: string;
    limit: number;
    offset: number;
    sort: string;
    order: 'asc' | 'desc';  
  }): Promise<{ data: ScrapeListItem[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (opts.status) {
      filter.status = opts.status.toUpperCase();
    }
    if (opts.url) {
      const normalizedUrl = opts.url.trim();
      if (normalizedUrl) {
        const escaped = normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.url = new RegExp(escaped, 'i');
      }
    }

    const allowedSorts = ['createdAt', 'completedAt', 'status', 'url', 'durationMs'];
    const sortField = allowedSorts.includes(opts.sort) ? opts.sort : 'createdAt';

    const [entities, total] = await Promise.all([
      this.em.find(
        ScrapeEntity,
        filter,
        {
          fields: ['id', 'status', 'url', 'durationMs', 'createdAt', 'completedAt'] as const,
          limit: Math.min(opts.limit, 100),
          offset: opts.offset,
          orderBy: { [sortField]: opts.order === 'asc' ? 'ASC' : 'DESC' } as any,
        },
      ),
      this.em.count(ScrapeEntity, filter),
    ]);

    return {
      data: entities.map((e) => this.toListItem(e)),
      total,
    };
  }

  private toListItem(entity: Pick<ScrapeEntity, 'id' | 'status' | 'url' | 'durationMs' | 'createdAt' | 'completedAt'>): ScrapeListItem {
    return {
      id: entity.id,
      status: entity.status,
      url: entity.url,
      durationMs: entity.durationMs,
      createdAt: entity.createdAt.toISOString(),
      completedAt: entity.completedAt?.toISOString(),
    };
  }

  private async waitForCompletion(taskId: string, bullJobId: string): Promise<ScrapeResponse> {
    const queueEvents = new QueueEvents(SCRAPE_QUEUE, {
      connection: this.scrapeQueue.opts?.connection as any,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Scrape timed out'));
        }, SYNC_TIMEOUT_MS);

        const onCompleted = (args: { jobId: string }) => {
          if (args.jobId === bullJobId) {
            clearTimeout(timeout);
            cleanup();
            resolve();
          }
        };

        const onFailed = (args: { jobId: string; failedReason: string }) => {
          if (args.jobId === bullJobId) {
            clearTimeout(timeout);
            cleanup();
            resolve(); // still resolve so we can return the entity status
          }
        };

        const cleanup = () => {
          queueEvents.off('completed', onCompleted);
          queueEvents.off('failed', onFailed);
        };

        queueEvents.on('completed', onCompleted);
        queueEvents.on('failed', onFailed);
      });
    } finally {
      await queueEvents.close();
    }

    const entity = await this.em.findOneOrFail(ScrapeEntity, { id: taskId });
    this.em.clear();
    return this.toResponse(entity);
  }

  private toResponse(entity: ScrapeEntity): ScrapeResponse {
    return {
      id: entity.id,
      status: entity.status,
      url: entity.url,
      origin: entity.origin,
      result: entity.result,
      createdAt: entity.createdAt.toISOString(),
      completedAt: entity.completedAt?.toISOString(),
    };
  }
}
