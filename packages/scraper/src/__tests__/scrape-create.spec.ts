import type { EntityManager } from '@mikro-orm/mongodb';
import type { Queue } from 'bullmq';
import { ScrapeService } from '../api/scrape.service';

function createEntityManagerMock() {
  return {
    create: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EntityManager>;
}

function createQueueMock() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as unknown as jest.Mocked<Queue>;
}

describe('ScrapeService.createScrape', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists scrape entity and enqueues a job', async () => {
    const em = createEntityManagerMock();
    const queue = createQueueMock();
    const service = new ScrapeService(em, queue);

    em.create.mockImplementation((_entity, data) => ({
      id: 'scrape-1',
      status: 'PENDING',
      createdAt: new Date('2026-04-17T00:00:00.000Z'),
      ...data,
    }) as never);

    const result = await service.createScrape({
      url: 'https://docs.example.com/page',
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30_000,
      waitFor: 'domcontentloaded',
      async: true,
    });

    expect(em.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        url: 'https://docs.example.com/page',
        origin: 'https://example.com',
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'scrape',
      expect.objectContaining({ taskId: 'scrape-1', url: 'https://docs.example.com/page' }),
      expect.objectContaining({ jobId: 'scrape-1' }),
    );
    expect(result.status).toBe('PENDING');
  });
});