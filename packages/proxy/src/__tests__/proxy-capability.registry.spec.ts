import { ProxyProviderRegistry } from '../provider/proxy-provider.registry';

describe('ProxyProviderRegistry', () => {
  let registry: ProxyProviderRegistry;

  beforeEach(() => {
    registry = new ProxyProviderRegistry();
  });

  it('starts empty', () => {
    expect(registry.getAll()).toEqual([]);
    expect(registry.isManagedModeAvailable()).toBe(false);
  });

  it('registers and retrieves a provider', () => {
    const { z } = require('zod');
    registry.register({
      id: 'test-provider',
      name: 'Test',
      description: 'Test provider',
      configSchema: z.object({ key: z.string() }),
    });

    expect(registry.has('test-provider')).toBe(true);
    expect(registry.getProvider('test-provider')!.name).toBe('Test');
    expect(registry.isManagedModeAvailable()).toBe(true);
  });

  it('returns undefined for unknown provider', () => {
    expect(registry.getProvider('unknown')).toBeUndefined();
    expect(registry.has('unknown')).toBe(false);
  });
});
