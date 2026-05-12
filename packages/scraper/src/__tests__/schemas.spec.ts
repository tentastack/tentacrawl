import {
  createScrapeDto,
  scrapePayloadSchema,
  scrapeResultSchema,
  scrapeResponseSchema,
} from '../data/schemas';

describe('createScrapeDto', () => {
  it('parses minimal valid input', () => {
    const result = createScrapeDto.parse({ url: 'https://example.com' });
    expect(result.url).toBe('https://example.com');
    expect(result.artefacts).toEqual(['html', 'markdown', 'metadata', 'links']);
    expect(result.networkPolicy).toEqual({ mode: 'none' });
    expect(result.timeout).toBe(30_000);
    expect(result.waitFor).toBe('domcontentloaded');
    expect(result.async).toBe(false);
  });

  it('accepts all fields', () => {
    const input = {
      url: 'https://example.com/page',
      artefacts: ['html', 'screenshot'],
      networkPolicy: { mode: 'static', proxy: { server: 'http://proxy:8080' } },
      timeout: 60000,
      waitFor: 'networkidle',
      locale: 'pl-PL',
      timezone: 'Europe/Warsaw',
      headers: { 'X-Custom': 'value' },
      dsl: 'name: test\nsteps: []',
      async: true,
    };
    const result = createScrapeDto.parse(input);
    expect(result.artefacts).toEqual(['html', 'screenshot']);
    expect(result.networkPolicy.mode).toBe('static');
    expect(result.timeout).toBe(60000);
    expect(result.locale).toBe('pl-PL');
    expect(result.async).toBe(true);
  });

  it('treats blank locale and timezone as unset', () => {
    const result = createScrapeDto.parse({
      url: 'https://example.com',
      locale: '   ',
      timezone: '',
    });

    expect(result.locale).toBeUndefined();
    expect(result.timezone).toBeUndefined();
  });

  it('rejects invalid url', () => {
    const result = createScrapeDto.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects timeout above 120s', () => {
    const result = createScrapeDto.safeParse({
      url: 'https://example.com',
      timeout: 200_000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty artefacts array', () => {
    const result = createScrapeDto.safeParse({
      url: 'https://example.com',
      artefacts: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid artefact values', () => {
    const result = createScrapeDto.safeParse({
      url: 'https://example.com',
      artefacts: ['pdf'],
    });
    expect(result.success).toBe(false);
  });
});

describe('scrapePayloadSchema', () => {
  it('validates a complete payload', () => {
    const payload = {
      taskId: 'abc-123',
      url: 'https://example.com',
      artefacts: ['html', 'markdown'],
      networkPolicy: { mode: 'none' },
      timeout: 30000,
      waitFor: 'domcontentloaded',
    };
    const result = scrapePayloadSchema.parse(payload);
    expect(result.taskId).toBe('abc-123');
  });

  it('rejects missing taskId', () => {
    const result = scrapePayloadSchema.safeParse({
      url: 'https://example.com',
      artefacts: ['html'],
      networkPolicy: { mode: 'none' },
      timeout: 30000,
      waitFor: 'domcontentloaded',
    });
    expect(result.success).toBe(false);
  });
});

describe('scrapeResultSchema', () => {
  it('validates OK result', () => {
    const result = scrapeResultSchema.parse({
      outcome: 'OK',
      artefacts: { html: '<html></html>', markdown: '# Title' },
      durationMs: 1500,
      httpStatus: 200,
    });
    expect(result.outcome).toBe('OK');
  });

  it('validates ERROR result', () => {
    const result = scrapeResultSchema.parse({
      outcome: 'ERROR',
      artefacts: {},
      durationMs: 200,
      error: 'HTTP 500',
    });
    expect(result.error).toBe('HTTP 500');
  });
});

describe('scrapeResponseSchema', () => {
  it('validates pending response', () => {
    const result = scrapeResponseSchema.parse({
      id: '123',
      status: 'PENDING',
      url: 'https://example.com',
      origin: 'https://example.com',
      queueDelayMs: 0,
      createdAt: new Date().toISOString(),
    });
    expect(result.status).toBe('PENDING');
  });

  it('validates completed response with result', () => {
    const result = scrapeResponseSchema.parse({
      id: '123',
      status: 'COMPLETED',
      url: 'https://example.com',
      origin: 'https://example.com',
      queueDelayMs: 1_000,
      throttleReason: 'origin-spacing',
      scheduledAt: new Date().toISOString(),
      result: {
        outcome: 'OK',
        artefacts: { html: '<html></html>' },
        durationMs: 500,
      },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    expect(result.result?.outcome).toBe('OK');
  });

  it('rejects non-http urls for scraper requests', () => {
    const result = createScrapeDto.safeParse({ url: 'ftp://example.com' });
    expect(result.success).toBe(false);
  });
});
