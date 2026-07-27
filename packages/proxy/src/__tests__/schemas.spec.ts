import {
  createProxyServerDto,
  listProxyServersQuerySchema,
  proxyExtensionConfigSchema,
} from '../data/schemas';

describe('createProxyServerDto', () => {
  it('accepts a minimal server with one endpoint', () => {
    const parsed = createProxyServerDto.parse({
      name: 'eu-pool',
      endpoints: [{ url: 'http://gw1.example:8080' }],
    });
    expect(parsed.enabled).toBe(true);
    expect(parsed.endpoints).toHaveLength(1);
  });

  it('accepts multiple endpoints sharing credentials', () => {
    const parsed = createProxyServerDto.parse({
      name: 'eu-pool',
      username: 'user',
      password: 'pass',
      notes: 'residential, EU contract',
      endpoints: [
        { url: 'http://gw1.example:8080' },
        { id: 'existing-id', url: 'socks5://gw2.example:1080' },
      ],
    });
    expect(parsed.endpoints[1].id).toBe('existing-id');
  });

  it('rejects servers without endpoints', () => {
    expect(() =>
      createProxyServerDto.parse({ name: 'empty', endpoints: [] }),
    ).toThrow();
  });

  it('accepts an ISO alpha-2 location and rejects other shapes', () => {
    const parsed = createProxyServerDto.parse({
      name: 'pl-pool',
      location: 'PL',
      endpoints: [{ url: 'http://gw1.example:8080' }],
    });
    expect(parsed.location).toBe('PL');

    for (const invalid of ['pl', 'POL', 'Poland', '12']) {
      expect(() =>
        createProxyServerDto.parse({
          name: 'bad',
          location: invalid,
          endpoints: [{ url: 'http://gw1.example:8080' }],
        }),
      ).toThrow();
    }
  });

  it('rejects endpoints that are not URLs', () => {
    expect(() =>
      createProxyServerDto.parse({
        name: 'bad',
        endpoints: [{ url: 'not a url' }],
      }),
    ).toThrow();
  });

  it('accepts scheme-less host:port endpoints, matching what Playwright treats as an HTTP proxy', () => {
    const parsed = createProxyServerDto.parse({
      name: 'brightdata',
      endpoints: [{ url: 'brd.superproxy.io:33335' }, { url: '127.0.0.1:8080' }],
    });
    expect(parsed.endpoints.map((e) => e.url)).toEqual([
      'brd.superproxy.io:33335',
      '127.0.0.1:8080',
    ]);
  });
});

describe('listProxyServersQuerySchema', () => {
  it('applies defaults to an empty query', () => {
    expect(listProxyServersQuerySchema.parse({})).toEqual({
      limit: 20,
      offset: 0,
      sort: 'name',
      order: 'asc',
      enabled: undefined,
    });
  });

  it('coerces and transforms query string values', () => {
    const parsed = listProxyServersQuerySchema.parse({
      enabled: 'false',
      location: 'US',
      usage: 'failing',
      limit: '50',
      offset: '100',
      sort: 'createdAt',
      order: 'desc',
    });
    expect(parsed).toMatchObject({
      enabled: false,
      location: 'US',
      usage: 'failing',
      limit: 50,
      offset: 100,
      sort: 'createdAt',
      order: 'desc',
    });
  });

  it('rejects oversized limits and unknown sorts', () => {
    expect(() => listProxyServersQuerySchema.parse({ limit: '500' })).toThrow();
    expect(() => listProxyServersQuerySchema.parse({ sort: 'password' })).toThrow();
  });
});

describe('proxyExtensionConfigSchema', () => {
  it('applies defaults to an empty config', () => {
    expect(proxyExtensionConfigSchema.parse({})).toEqual({
      rotation: 'round-robin',
      countBlockedAsFailure: true,
    });
  });

  it('rejects unknown rotation strategies', () => {
    expect(() =>
      proxyExtensionConfigSchema.parse({ rotation: 'sticky' }),
    ).toThrow();
  });
});
