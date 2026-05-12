import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EntityManager } from '@mikro-orm/mongodb';
import { Queue } from 'bullmq';
import {
  CRAWL_ORCHESTRATOR_QUEUE,
  CRAWL_ORCHESTRATOR_QUEUE_DEFAULT_OPTS,
} from '@tentacrawl/core';
import { CrawlEntity, CrawlPageEntity } from '../data/entities';
import type {
  CreateCrawlDto,
  CrawlOrchestratorPayload,
  CrawlPageListItem,
  CrawlPageListResponse,
  CrawlResponse,
  CrawlPageResponse,
} from '../data/schemas';
import { extractUrlOrigin } from '@tentacrawl/core/url';

@Injectable()
export class CrawlService {
  private readonly logger = new Logger(CrawlService.name);

  constructor(
    private readonly em: EntityManager,
    @InjectQueue(CRAWL_ORCHESTRATOR_QUEUE)
    private readonly crawlOrchestratorQueue: Queue,
  ) {}

  async createCrawl(dto: CreateCrawlDto): Promise<CrawlResponse> {
    const origin = extractUrlOrigin(dto.url);
    const entity = this.em.create(CrawlEntity, {
      url: dto.url,
      origin,
      maxDepth: dto.maxDepth,
      maxPages: dto.maxPages,
      artefacts: [...dto.artefacts],
      status: 'PENDING',
      networkPolicy: dto.networkPolicy,
      timeout: dto.timeout,
      waitFor: dto.waitFor,
      locale: dto.locale,
      timezone: dto.timezone,
      headers: dto.headers,
      includePattern: dto.includePattern,
      excludePattern: dto.excludePattern,
      dslYaml: dto.dsl,
    });

    await this.em.flush();

    const payload: CrawlOrchestratorPayload = {
      crawlId: entity.id,
      url: dto.url,
      maxDepth: dto.maxDepth,
      maxPages: dto.maxPages,
      artefacts: [...dto.artefacts],
      networkPolicy: dto.networkPolicy,
      timeout: dto.timeout,
      waitFor: dto.waitFor,
      locale: dto.locale,
      timezone: dto.timezone,
      headers: dto.headers,
      includePattern: dto.includePattern,
      excludePattern: dto.excludePattern,
      dslYaml: dto.dsl,
    };

    await this.crawlOrchestratorQueue.add(
      'crawl-orchestrate',
      payload,
      { ...CRAWL_ORCHESTRATOR_QUEUE_DEFAULT_OPTS, jobId: entity.id },
    );

    this.logger.log(`Crawl ${entity.id} enqueued for ${dto.url}`);
    return this.toResponse(entity);
  }

  async getCrawl(id: string): Promise<CrawlResponse> {
    const entity = await this.em.findOneOrFail(CrawlEntity, { id });
    return this.toResponse(entity);
  }

  async listCrawls(opts: {
    status?: string;
    url?: string;
    limit: number;
    offset: number;
    sort: string;
    order: 'asc' | 'desc';
  }): Promise<{ data: CrawlResponse[]; total: number }> {
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

    const allowedSorts = ['createdAt', 'completedAt', 'status', 'totalPages'];
    const sortField = allowedSorts.includes(opts.sort) ? opts.sort : 'createdAt';

    const [entities, total] = await this.em.findAndCount(
      CrawlEntity,
      filter,
      {
        limit: Math.min(opts.limit, 100),
        offset: opts.offset,
        orderBy: { [sortField]: opts.order === 'asc' ? 'ASC' : 'DESC' } as any,
      },
    );

    return {
      data: entities.map((e) => this.toResponse(e)),
      total,
    };
  }

  async getCrawlPages(
    crawlId: string,
    limit = 50,
    offset = 0,
    status?: string,
    url?: string,
  ): Promise<CrawlPageListResponse> {
    const filter: Record<string, unknown> = { crawlId };
    if (status) {
      const statuses = status
        .split(',')
        .map((entry) => entry.trim().toUpperCase())
        .filter((entry) => entry.length > 0);

      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }
    if (url) {
      const normalizedUrl = url.trim();
      if (normalizedUrl) {
        const escaped = normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.url = new RegExp(escaped, 'i');
      }
    }
    const [pages, total] = await Promise.all([
      this.em.find(
        CrawlPageEntity,
        filter,
        {
          fields: ['id', 'crawlId', 'url', 'depth', 'status', 'durationMs', 'discoveredUrlCount', 'createdAt', 'completedAt'] as const,
          limit,
          offset,
          orderBy: { createdAt: 'ASC' },
        },
      ),
      this.em.count(CrawlPageEntity, filter),
    ]);

    return {
      data: pages.map((p) => this.pageToListItem(p)),
      total,
    };
  }

  async getCrawlPage(crawlId: string, pageId: string): Promise<CrawlPageResponse> {
    const page = await this.em.findOneOrFail(CrawlPageEntity, { id: pageId, crawlId });
    return this.pageToResponse(page);
  }

  async cancelCrawl(id: string): Promise<CrawlResponse> {
    const entity = await this.em.findOneOrFail(CrawlEntity, { id });
    if (entity.status === 'PENDING' || entity.status === 'PROCESSING') {
      entity.status = 'CANCELLED';
      entity.completedAt = new Date();

      await this.em.nativeUpdate(
        CrawlPageEntity,
        { crawlId: id, status: 'PENDING' },
        { status: 'SKIPPED' },
      );

      await this.em.flush();
    }
    return this.toResponse(entity);
  }

  private toResponse(entity: CrawlEntity): CrawlResponse {
    return {
      id: entity.id,
      status: entity.status,
      url: entity.url,
      maxDepth: entity.maxDepth,
      maxPages: entity.maxPages,
      artefacts: entity.artefacts as CrawlResponse['artefacts'],
      networkPolicy: entity.networkPolicy,
      timeout: entity.timeout,
      waitFor: entity.waitFor as CrawlResponse['waitFor'],
      locale: entity.locale,
      timezone: entity.timezone,
      headers: entity.headers,
      includePattern: entity.includePattern,
      excludePattern: entity.excludePattern,
      dsl: entity.dslYaml,
      totalPages: entity.totalPages,
      completedPages: entity.completedPages,
      failedPages: entity.failedPages,
      createdAt: entity.createdAt.toISOString(),
      completedAt: entity.completedAt?.toISOString(),
    };
  }

  private pageToResponse(entity: CrawlPageEntity): CrawlPageResponse {
    return {
      id: entity.id,
      crawlId: entity.crawlId,
      url: entity.url,
      depth: entity.depth,
      status: entity.status,
      result: entity.result,
      createdAt: entity.createdAt.toISOString(),
      completedAt: entity.completedAt?.toISOString(),
    };
  }

  private pageToListItem(entity: Pick<CrawlPageEntity, 'id' | 'crawlId' | 'url' | 'depth' | 'status' | 'durationMs' | 'discoveredUrlCount' | 'createdAt' | 'completedAt'>): CrawlPageListItem {
    return {
      id: entity.id,
      crawlId: entity.crawlId,
      url: entity.url,
      depth: entity.depth,
      status: entity.status,
      durationMs: entity.durationMs,
      discoveredUrlCount: entity.discoveredUrlCount,
      createdAt: entity.createdAt.toISOString(),
      completedAt: entity.completedAt?.toISOString(),
    };
  }

}
