import {
  createCrawlDto,
  crawlOrchestratorPayloadSchema,
  crawlPagePayloadSchema,
  crawlPageResultSchema,
  crawlResponseSchema,
  crawlPageResponseSchema,
} from '../data/schemas';

describe('createCrawlDto', () => {
  it('parses minimal valid input', () => {
    const result = createCrawlDto.parse({ url: 'https://example.com' });
    expect(result.url).toBe('https://example.com');
    expect(result.maxDepth).toBe(2);
    expect(result.maxPages).toBe(50);
    expect(result.artefacts).toEqual(['html', 'markdown', 'metadata', 'links']);
    expect(result.networkPolicy).toEqual({ mode: 'none' });
    expect(result.timeout).toBe(30_000);
    expect(result.waitFor).toBe('domcontentloaded');
  });

  it('accepts all fields', () => {
    const input = {
      url: 'https://example.com',
      maxDepth: 5,
      maxPages: 200,
      artefacts: ['html', 'screenshot'],
      networkPolicy: { mode: 'static', proxy: { server: 'http://proxy:8080' } },
      timeout: 60000,
      waitFor: 'networkidle',
      locale: 'pl-PL',
      timezone: 'Europe/Warsaw',
      headers: { 'X-Custom': 'value' },
      includePattern: '/blog/.*',
      excludePattern: '/admin/.*',
      dsl: 'name: test\nsteps: []',
    };
    const result = createCrawlDto.parse(input);
    expect(result.maxDepth).toBe(5);
    expect(result.maxPages).toBe(200);
    expect(result.includePattern).toBe('/blog/.*');
    expect(result.excludePattern).toBe('/admin/.*');
  });

  it('treats blank locale and timezone as unset', () => {
    const result = createCrawlDto.parse({
      url: 'https://example.com',
      locale: '   ',
      timezone: '',
    });

    expect(result.locale).toBeUndefined();
    expect(result.timezone).toBeUndefined();
  });

  it('rejects invalid url', () => {
    expect(createCrawlDto.safeParse({ url: 'bad' }).success).toBe(false);
  });

  it('rejects maxDepth > 10', () => {
    expect(
      createCrawlDto.safeParse({ url: 'https://example.com', maxDepth: 11 }).success,
    ).toBe(false);
  });

  it('rejects maxPages > 10000', () => {
    expect(
      createCrawlDto.safeParse({ url: 'https://example.com', maxPages: 20000 }).success,
    ).toBe(false);
  });
});

describe('crawlOrchestratorPayloadSchema', () => {
  it('validates a complete payload', () => {
    const result = crawlOrchestratorPayloadSchema.parse({
      crawlId: 'abc',
      url: 'https://example.com',
      maxDepth: 2,
      maxPages: 50,
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30000,
      waitFor: 'domcontentloaded',
    });
    expect(result.crawlId).toBe('abc');
  });
});

describe('crawlPagePayloadSchema', () => {
  it('validates a complete page payload', () => {
    const result = crawlPagePayloadSchema.parse({
      crawlId: 'abc',
      pageId: 'page-1',
      url: 'https://example.com/about',
      depth: 1,
      artefacts: ['html', 'markdown'],
      networkPolicy: { mode: 'none' },
      timeout: 30000,
      waitFor: 'domcontentloaded',
      maxDepth: 2,
      maxPages: 50,
    });
    expect(result.depth).toBe(1);
    expect(result.pageId).toBe('page-1');
  });
});

describe('crawlPageResultSchema', () => {
  it('validates OK result with discovered URLs', () => {
    const result = crawlPageResultSchema.parse({
      outcome: 'OK',
      artefacts: { html: '<html></html>' },
      durationMs: 1500,
      finalUrl: 'https://example.com/',
      discoveredUrls: ['https://example.com/about', 'https://example.com/contact'],
    });
    expect(result.finalUrl).toBe('https://example.com/');
    expect(result.discoveredUrls).toHaveLength(2);
  });

  it('defaults discoveredUrls to empty array', () => {
    const result = crawlPageResultSchema.parse({
      outcome: 'ERROR',
      artefacts: {},
      durationMs: 200,
      error: 'timeout',
    });
    expect(result.discoveredUrls).toEqual([]);
  });
});

describe('crawlResponseSchema', () => {
  it('validates crawl response', () => {
    const result = crawlResponseSchema.parse({
      id: '123',
      status: 'PROCESSING',
      url: 'https://example.com',
      maxDepth: 2,
      maxPages: 10,
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30_000,
      waitFor: 'domcontentloaded',
      totalPages: 10,
      completedPages: 5,
      failedPages: 1,
      createdAt: new Date().toISOString(),
    });
    expect(result.status).toBe('PROCESSING');
    expect(result.totalPages).toBe(10);
  });
});

describe('crawlPageResponseSchema', () => {
  it('validates page response', () => {
    const result = crawlPageResponseSchema.parse({
      id: 'page-1',
      crawlId: 'crawl-1',
      url: 'https://example.com/about',
      depth: 1,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    expect(result.status).toBe('COMPLETED');
    expect(result.depth).toBe(1);
  });
});
