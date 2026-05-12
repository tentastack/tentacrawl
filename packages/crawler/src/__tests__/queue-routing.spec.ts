import {
  CRAWL_ORCHESTRATOR_QUEUE_DEFAULT_OPTS,
  CRAWL_PAGE_QUEUE_DEFAULT_OPTS,
} from '@tentacrawl/core';
import type { ActivityLogRecorder } from '@tentacrawl/core/activity';
import type { NotificationPublisher } from '@tentacrawl/core/notification';
import type { EntityManager } from '@mikro-orm/mongodb';
import type { Queue } from 'bullmq';
import { CrawlService } from '../api/crawl.service';
import { CrawlOrchestratorService } from '../worker/crawl-orchestrator.service';
import type { CrawlOrchestratorPayload } from '../data/schemas';

function createEntityManagerMock() {
  return {
    create: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<EntityManager>;
}

function createQueueMock() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    addBulk: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<Queue>;
}

function createActivityLogRecorderMock() {
  return {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ActivityLogRecorder>;
}

function createNotificationPublisherMock() {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationPublisher>;
}

describe('crawler queue routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues crawl creation on the orchestrator queue', async () => {
    const em = createEntityManagerMock();
    const orchestratorQueue = createQueueMock();
    const crawlEntity = {
      id: 'crawl-1',
      status: 'PENDING',
      url: 'https://example.com',
      maxDepth: 2,
      maxPages: 20,
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30_000,
      waitFor: 'domcontentloaded',
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
      totalPages: 0,
      completedPages: 0,
      failedPages: 0,
    };

    em.create.mockReturnValue(crawlEntity as never);

    const service = new CrawlService(em, orchestratorQueue);

    await service.createCrawl({
      url: 'https://mail.example.com',
      maxDepth: 2,
      maxPages: 20,
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30_000,
      waitFor: 'domcontentloaded',
    });

    expect(em.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        url: 'https://mail.example.com',
        origin: 'https://example.com',
      }),
    );

    expect(orchestratorQueue.add).toHaveBeenCalledWith(
      'crawl-orchestrate',
      expect.objectContaining({
        crawlId: 'crawl-1',
        url: 'https://mail.example.com',
      }),
      { ...CRAWL_ORCHESTRATOR_QUEUE_DEFAULT_OPTS, jobId: 'crawl-1' },
    );
  });

  it('seeds the first crawl page on the page queue', async () => {
    const em = createEntityManagerMock();
    const pageQueue = createQueueMock();
    const activityLogRecorder = createActivityLogRecorderMock();
    const notificationPublisher = createNotificationPublisherMock();
    const crawlEntity = {
      id: 'crawl-1',
      status: 'PENDING',
      totalPages: 0,
      url: 'https://example.com',
    };
    const seedPage = {
      id: 'page-1',
      crawlId: 'crawl-1',
      url: 'https://example.com',
      depth: 0,
      status: 'PENDING',
    };

    em.findOneOrFail.mockResolvedValue(crawlEntity as never);
    em.create.mockReturnValue(seedPage as never);

    const service = new CrawlOrchestratorService(
      em,
      pageQueue,
      activityLogRecorder,
      notificationPublisher,
    );

    const payload: CrawlOrchestratorPayload = {
      crawlId: 'crawl-1',
      url: 'https://example.com',
      maxDepth: 2,
      maxPages: 20,
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30_000,
      waitFor: 'domcontentloaded',
    };

    await service.orchestrate(payload);

    expect(pageQueue.add).toHaveBeenCalledWith(
      'crawl-page',
      expect.objectContaining({
        crawlId: 'crawl-1',
        pageId: 'page-1',
        depth: 0,
      }),
      { ...CRAWL_PAGE_QUEUE_DEFAULT_OPTS, jobId: 'crawl-1--page-1' },
    );
    expect(crawlEntity.status).toBe('PROCESSING');
    expect(crawlEntity.totalPages).toBe(1);
  });

  it('reuses the existing seed page on orchestration retry', async () => {
    const em = createEntityManagerMock();
    const pageQueue = createQueueMock();
    const activityLogRecorder = createActivityLogRecorderMock();
    const notificationPublisher = createNotificationPublisherMock();
    const crawlEntity = {
      id: 'crawl-1',
      status: 'PROCESSING',
      totalPages: 1,
      url: 'https://example.com',
    };
    const seedPage = {
      id: 'page-1',
      crawlId: 'crawl-1',
      url: 'https://example.com',
      depth: 0,
      status: 'PENDING',
    };

    em.findOneOrFail.mockResolvedValue(crawlEntity as never);
    em.findOne = jest.fn().mockResolvedValue(seedPage as never);

    const service = new CrawlOrchestratorService(
      em,
      pageQueue,
      activityLogRecorder,
      notificationPublisher,
    );

    await service.orchestrate({
      crawlId: 'crawl-1',
      url: 'https://example.com',
      maxDepth: 2,
      maxPages: 20,
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30_000,
      waitFor: 'domcontentloaded',
    });

    expect(em.create).not.toHaveBeenCalled();
    expect(pageQueue.add).toHaveBeenCalledWith(
      'crawl-page',
      expect.objectContaining({ pageId: 'page-1' }),
      expect.objectContaining({ jobId: 'crawl-1--page-1' }),
    );
    expect(crawlEntity.totalPages).toBe(1);
  });

  it('enqueues discovered pages on the page queue in bulk', async () => {
    const em = createEntityManagerMock();
    const pageQueue = createQueueMock();
    const activityLogRecorder = createActivityLogRecorderMock();
    const notificationPublisher = createNotificationPublisherMock();
    const crawlEntity = {
      id: 'crawl-1',
      status: 'PROCESSING',
      url: 'https://example.com',
      totalPages: 1,
      completedPages: 0,
      failedPages: 0,
    };

    let pageIndex = 0;
    em.findOneOrFail.mockResolvedValue(crawlEntity as never);
    em.create.mockImplementation((_, data: any) => ({
      id: `page-${++pageIndex}`,
      crawlId: data.crawlId,
      url: data.url,
      depth: data.depth,
      status: 'PENDING',
    }) as never);

    const service = new CrawlOrchestratorService(
      em,
      pageQueue,
      activityLogRecorder,
      notificationPublisher,
    );

    await service.onPageComplete(
      'crawl-1',
      ['https://example.com/about', 'https://example.com/contact'],
      0,
      {
        crawlId: 'crawl-1',
        pageId: 'page-seed',
        url: 'https://example.com',
        depth: 0,
        artefacts: ['html'],
        networkPolicy: { mode: 'none' },
        timeout: 30_000,
        waitFor: 'domcontentloaded',
        maxDepth: 2,
        maxPages: 20,
      },
    );

    expect(pageQueue.addBulk).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'crawl-page',
        data: expect.objectContaining({
          crawlId: 'crawl-1',
          pageId: 'page-1',
          depth: 1,
          url: 'https://example.com/about',
        }),
        opts: { ...CRAWL_PAGE_QUEUE_DEFAULT_OPTS, jobId: 'crawl-1--page-1' },
      }),
      expect.objectContaining({
        name: 'crawl-page',
        data: expect.objectContaining({
          crawlId: 'crawl-1',
          pageId: 'page-2',
          depth: 1,
          url: 'https://example.com/contact',
        }),
        opts: { ...CRAWL_PAGE_QUEUE_DEFAULT_OPTS, jobId: 'crawl-1--page-2' },
      }),
    ]);
    expect(crawlEntity.totalPages).toBe(3);
  });

  it('ignores discovered links that point back to the current page', async () => {
    const em = createEntityManagerMock();
    const pageQueue = createQueueMock();
    const activityLogRecorder = createActivityLogRecorderMock();
    const notificationPublisher = createNotificationPublisherMock();
    const crawlEntity = {
      id: 'crawl-1',
      status: 'PROCESSING',
      url: 'https://example.com',
      totalPages: 1,
      completedPages: 0,
      failedPages: 0,
    };

    let pageIndex = 0;
    em.findOneOrFail.mockResolvedValue(crawlEntity as never);
    em.create.mockImplementation((_, data: any) => ({
      id: `page-${++pageIndex}`,
      crawlId: data.crawlId,
      url: data.url,
      depth: data.depth,
      status: 'PENDING',
    }) as never);

    const service = new CrawlOrchestratorService(
      em,
      pageQueue,
      activityLogRecorder,
      notificationPublisher,
    );

    await service.onPageComplete(
      'crawl-1',
      ['https://www.example.com/', 'https://www.example.com/about'],
      0,
      {
        crawlId: 'crawl-1',
        pageId: 'page-seed',
        url: 'https://www.example.com/',
        depth: 0,
        artefacts: ['html'],
        networkPolicy: { mode: 'none' },
        timeout: 30_000,
        waitFor: 'domcontentloaded',
        maxDepth: 2,
        maxPages: 20,
      },
    );

    expect(pageQueue.addBulk).toHaveBeenCalledWith([
      expect.objectContaining({
        data: expect.objectContaining({
          url: 'https://www.example.com/about',
        }),
      }),
    ]);
    expect(crawlEntity.totalPages).toBe(2);
  });
});