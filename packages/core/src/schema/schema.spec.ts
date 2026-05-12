import {
  proxyModeSchema,
  taskStatusSchema,
  crawlStatusSchema,
  crawlPageStatusSchema,
  runOutcomeSchema,
  networkPolicySchema,
  staticProxyConfigSchema,
  artefactFormatSchema,
  ARTEFACT_FORMATS,
  DEFAULT_ARTEFACT_FORMATS,
  pageMetadataSchema,
  pageLinkSchema,
  artefactResultSchema,
  traceSchema,
  runEnvSchema,
} from '../schema';

describe('enums', () => {
  it('validates proxy modes', () => {
    expect(proxyModeSchema.parse('none')).toBe('none');
    expect(proxyModeSchema.parse('static')).toBe('static');
    expect(proxyModeSchema.parse('managed')).toBe('managed');
    expect(() => proxyModeSchema.parse('proxy')).toThrow();
    expect(() => proxyModeSchema.parse('direct')).toThrow();
    expect(() => proxyModeSchema.parse('invalid')).toThrow();
  });

  it('validates task statuses', () => {
    for (const s of ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const) {
      expect(taskStatusSchema.parse(s)).toBe(s);
    }
    expect(() => taskStatusSchema.parse('UNKNOWN')).toThrow();
  });

  it('validates crawl statuses', () => {
    for (const s of ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const) {
      expect(crawlStatusSchema.parse(s)).toBe(s);
    }
  });

  it('validates crawl page statuses', () => {
    for (const s of ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'] as const) {
      expect(crawlPageStatusSchema.parse(s)).toBe(s);
    }
  });

  it('validates run outcomes', () => {
    for (const s of ['OK', 'ERROR', 'PRECONDITION_FAILED', 'BLOCKED'] as const) {
      expect(runOutcomeSchema.parse(s)).toBe(s);
    }
    expect(() => runOutcomeSchema.parse('INVALID')).toThrow();
  });
});

describe('networkPolicySchema', () => {
  it('accepts none mode', () => {
    const result = networkPolicySchema.parse({ mode: 'none' });
    expect(result.mode).toBe('none');
  });

  it('accepts static mode with proxy config', () => {
    const result = networkPolicySchema.parse({
      mode: 'static',
      proxy: { server: 'http://proxy:8080', username: 'u', password: 'p' },
    });
    expect(result.mode).toBe('static');
    if (result.mode === 'static') {
      expect(result.proxy.server).toBe('http://proxy:8080');
    }
  });

  it('rejects static mode without proxy', () => {
    expect(() => networkPolicySchema.parse({ mode: 'static' })).toThrow();
  });

  it('accepts managed mode with poolId', () => {
    const result = networkPolicySchema.parse({ mode: 'managed', poolId: 'pool-1' });
    expect(result.mode).toBe('managed');
    if (result.mode === 'managed') {
      expect(result.poolId).toBe('pool-1');
    }
  });

  it('rejects managed mode without poolId', () => {
    expect(() => networkPolicySchema.parse({ mode: 'managed' })).toThrow();
  });

  it('rejects unknown mode', () => {
    expect(() => networkPolicySchema.parse({ mode: 'proxy' })).toThrow();
  });
});

describe('staticProxyConfigSchema', () => {
  it('requires server', () => {
    expect(staticProxyConfigSchema.parse({ server: 'http://proxy:8080' }).server).toBe('http://proxy:8080');
    expect(() => staticProxyConfigSchema.parse({})).toThrow();
  });

  it('accepts optional username and password', () => {
    const result = staticProxyConfigSchema.parse({
      server: 'http://proxy:8080',
      username: 'u',
      password: 'p',
    });
    expect(result.username).toBe('u');
    expect(result.password).toBe('p');
  });
});

describe('artefactFormatSchema', () => {
  it('validates all artefact formats', () => {
    for (const f of ARTEFACT_FORMATS) {
      expect(artefactFormatSchema.parse(f)).toBe(f);
    }
    expect(() => artefactFormatSchema.parse('pdf')).toThrow();
  });

  it('default artefact formats contain expected values', () => {
    expect(DEFAULT_ARTEFACT_FORMATS).toContain('html');
    expect(DEFAULT_ARTEFACT_FORMATS).toContain('markdown');
    expect(DEFAULT_ARTEFACT_FORMATS).toContain('metadata');
    expect(DEFAULT_ARTEFACT_FORMATS).toContain('links');
    expect(DEFAULT_ARTEFACT_FORMATS).not.toContain('screenshot');
    expect(DEFAULT_ARTEFACT_FORMATS).not.toContain('extracted');
  });
});

describe('pageMetadataSchema', () => {
  it('accepts empty metadata', () => {
    const result = pageMetadataSchema.parse({});
    expect(result.title).toBeUndefined();
  });

  it('accepts full metadata', () => {
    const result = pageMetadataSchema.parse({
      title: 'Test',
      description: 'A test page',
      language: 'en',
      ogTitle: 'OG Test',
    });
    expect(result.title).toBe('Test');
    expect(result.ogTitle).toBe('OG Test');
  });
});

describe('pageLinkSchema', () => {
  it('validates a page link', () => {
    const link = pageLinkSchema.parse({
      url: 'https://example.com/page',
      text: 'Page',
      isInternal: true,
    });
    expect(link.url).toBe('https://example.com/page');
    expect(link.isInternal).toBe(true);
  });

  it('requires all fields', () => {
    expect(() => pageLinkSchema.parse({ url: 'https://example.com' })).toThrow();
  });
});

describe('artefactResultSchema', () => {
  it('accepts empty result', () => {
    const result = artefactResultSchema.parse({});
    expect(result.html).toBeUndefined();
  });

  it('accepts full result', () => {
    const result = artefactResultSchema.parse({
      html: '<html></html>',
      markdown: '# Test',
      metadata: { title: 'Test' },
      links: [{ url: 'https://example.com', text: 'Ex', isInternal: false }],
      screenshot: 'base64...',
      extracted: { key: 'value' },
    });
    expect(result.html).toBe('<html></html>');
    expect(result.links).toHaveLength(1);
  });
});

describe('traceSchema', () => {
  it('accepts valid trace', () => {
    const trace = traceSchema.parse({
      steps: [
        { index: 0, action: 'goto', durationMs: 120 },
        { index: 1, action: 'extractText', durationMs: 50, error: 'timeout' },
      ],
    });
    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[1].error).toBe('timeout');
  });
});

describe('runEnvSchema', () => {
  it('accepts minimal env', () => {
    const env = runEnvSchema.parse({ workerId: 'w-1' });
    expect(env.workerId).toBe('w-1');
    expect(env.proxyServer).toBeUndefined();
  });

  it('accepts full env', () => {
    const env = runEnvSchema.parse({
      workerId: 'w-1',
      proxyServer: 'http://proxy:8080',
      userAgent: 'Mozilla/5.0',
      viewport: '1920x1080',
    });
    expect(env.proxyServer).toBe('http://proxy:8080');
  });
});
