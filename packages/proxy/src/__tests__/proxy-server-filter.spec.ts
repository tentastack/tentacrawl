import { buildProxyServerFilter } from '../api/proxy-server.service';

describe('buildProxyServerFilter', () => {
  it('returns an empty filter when no params are set', () => {
    expect(buildProxyServerFilter({})).toEqual({});
  });

  it('matches name and endpoint url case-insensitively with escaped input', () => {
    const filter = buildProxyServerFilter({ name: 'eu.pool', endpoint: 'gw1.example' });
    expect(filter.name).toEqual(new RegExp('eu\\.pool', 'i'));
    expect(filter['endpoints.url']).toEqual(new RegExp('gw1\\.example', 'i'));
  });

  it('ignores whitespace-only text filters', () => {
    expect(buildProxyServerFilter({ name: '   ', endpoint: ' ' })).toEqual({});
  });

  it('filters by enabled flag and location', () => {
    expect(buildProxyServerFilter({ enabled: false, location: 'PL' })).toEqual({
      enabled: false,
      location: 'PL',
    });
  });

  it('builds usage filters against endpoint counters', () => {
    expect(buildProxyServerFilter({ usage: 'used' })).toEqual({
      'endpoints.timesUsed': { $gt: 0 },
    });
    expect(buildProxyServerFilter({ usage: 'unused' })).toEqual({
      'endpoints.timesUsed': { $not: { $gt: 0 } },
    });
    expect(buildProxyServerFilter({ usage: 'failing' })).toEqual({
      'endpoints.timesFailed': { $gt: 0 },
    });
  });
});
