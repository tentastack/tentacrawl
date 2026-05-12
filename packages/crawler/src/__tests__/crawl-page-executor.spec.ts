jest.mock('@tentacrawl/browser', () => ({
  createHardenedContext: jest.fn(),
  collectArtefacts: jest.fn(),
  discoverLinks: jest.fn(),
  normalizeDiscoveredUrl: jest.requireActual('@tentacrawl/browser').normalizeDiscoveredUrl,
}));

import {
  createHardenedContext,
  collectArtefacts,
  discoverLinks,
} from '@tentacrawl/browser';
import { CrawlPageExecutorService } from '../worker/crawl-page-executor.service';

describe('CrawlPageExecutorService', () => {
  it('uses the final navigated URL for discovery and persistence', async () => {
    const pageEntity = {
      id: 'page-1',
      url: 'https://example.com',
      status: 'PENDING',
    };
    const em = {
      findOneOrFail: jest.fn()
        .mockResolvedValueOnce({ id: 'crawl-1', status: 'PROCESSING' })
        .mockResolvedValueOnce(pageEntity)
        .mockResolvedValueOnce(pageEntity),
      flush: jest.fn().mockResolvedValue(undefined),
      getCollection: jest.fn().mockReturnValue({
        updateOne: jest.fn().mockResolvedValue(undefined),
      }),
    };
    const extensions = {
      getHooks: jest.fn().mockReturnValue([]),
    };
    const activityLogRecorder = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const page = {
      goto: jest.fn().mockResolvedValue({ status: () => 200 }),
      url: jest.fn().mockReturnValue('https://www.example.com/'),
    };
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined),
    };

    jest.mocked(createHardenedContext).mockResolvedValue({
      context: context as never,
      stealth: {
        userAgent: 'TestAgent/1.0',
        viewport: { width: 1280, height: 720 },
      },
    });
    jest.mocked(collectArtefacts).mockResolvedValue({ html: '<html />' });
    jest.mocked(discoverLinks).mockResolvedValue([
      { url: 'https://www.example.com/about', text: 'About', isInternal: true },
    ]);

    const service = new CrawlPageExecutorService(
      em as never,
      extensions as never,
      activityLogRecorder as never,
    );

    const result = await service.execute({
      crawlId: 'crawl-1',
      pageId: 'page-1',
      url: 'https://example.com',
      depth: 0,
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30_000,
      waitFor: 'domcontentloaded',
      maxDepth: 2,
      maxPages: 10,
    });

    expect(result.finalUrl).toBe('https://www.example.com/');
    expect(collectArtefacts).toHaveBeenCalledWith(
      page,
      ['html'],
      'https://www.example.com/',
    );
    expect(discoverLinks).toHaveBeenCalledWith(
      page,
      'https://www.example.com/',
    );
    expect(pageEntity.url).toBe('https://www.example.com/');
  });

  it('returns discovered internal links', async () => {
    const pageEntity = {
      id: 'page-1',
      url: 'https://example.com',
      status: 'PENDING',
    };
    const em = {
      findOneOrFail: jest.fn()
        .mockResolvedValueOnce({ id: 'crawl-1', status: 'PROCESSING' })
        .mockResolvedValueOnce(pageEntity)
        .mockResolvedValueOnce(pageEntity),
      flush: jest.fn().mockResolvedValue(undefined),
      getCollection: jest.fn().mockReturnValue({
        updateOne: jest.fn().mockResolvedValue(undefined),
      }),
    };
    const hook = {
      moduleId: 'test-hook',
      beforeRun: jest.fn().mockResolvedValue(undefined),
    };
    const extensions = {
      getHooks: jest.fn().mockReturnValue([hook]),
    };
    const activityLogRecorder = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const page = {
      goto: jest.fn().mockResolvedValue({ status: () => 200 }),
      url: jest.fn().mockReturnValue('https://www.example.com/'),
    };
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined),
    };

    jest.mocked(createHardenedContext).mockResolvedValue({
      context: context as never,
      stealth: {
        userAgent: 'TestAgent/1.0',
        viewport: { width: 1280, height: 720 },
      },
    });
    jest.mocked(collectArtefacts).mockResolvedValue({ html: '<html />' });
    jest.mocked(discoverLinks).mockResolvedValue([]);

    const service = new CrawlPageExecutorService(
      em as never,
      extensions as never,
      activityLogRecorder as never,
    );

    await service.execute({
      crawlId: 'crawl-1',
      pageId: 'page-1',
      url: 'https://example.com',
      depth: 0,
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30_000,
      waitFor: 'domcontentloaded',
      maxDepth: 2,
      maxPages: 10,
    });

    expect(discoverLinks).toHaveBeenCalledWith(
      page,
      'https://www.example.com/',
    );
  });
});