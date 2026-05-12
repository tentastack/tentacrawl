import { ProxyProviderRegistry } from '../provider/proxy-provider.registry';
import { Reflector } from '@nestjs/core';
import { ProxyProviderRegistrar } from '../api/proxy-provider.registrar';
import { PROXY_PROVIDER_META_KEY } from '../provider/proxy-provider.decorator';
import { brightdataPoolConfigSchema } from '../provider/brightdata.config';

describe('ProxyProviderRegistrar', () => {
  let registry: ProxyProviderRegistry;
  let registrar: ProxyProviderRegistrar;

  const meta = {
    id: 'brightdata',
    name: 'Bright Data',
    description: 'Residential/datacenter proxy network with session management',
    configSchema: brightdataPoolConfigSchema,
  };

  beforeEach(() => {
    registry = new ProxyProviderRegistry();

    class FakeProvider {}
    Reflect.defineMetadata(PROXY_PROVIDER_META_KEY, meta, FakeProvider);

    const reflector = new Reflector();
    registrar = new ProxyProviderRegistrar(registry, reflector, [FakeProvider]);
  });

  it('auto-discovers and registers providers on init', () => {
    registrar.onModuleInit();

    expect(registry.has('brightdata')).toBe(true);
    expect(registry.isManagedModeAvailable()).toBe(true);

    const info = registry.getProvider('brightdata');
    expect(info).toBeDefined();
    expect(info!.name).toBe('Bright Data');
  });

  it('provider configSchema validates correct config', () => {
    registrar.onModuleInit();
    const info = registry.getProvider('brightdata')!;

    const result = info.configSchema.safeParse({
      zone: 'zone1',
      customer: 'cust1',
      password: 'pass1',
    });
    expect(result.success).toBe(true);
  });

  it('provider configSchema rejects invalid config', () => {
    registrar.onModuleInit();
    const info = registry.getProvider('brightdata')!;

    const result = info.configSchema.safeParse({ zone: '' });
    expect(result.success).toBe(false);
  });

  it('skips classes without provider metadata', () => {
    class PlainClass {}
    const reflector = new Reflector();
    const reg = new ProxyProviderRegistry();
    const r = new ProxyProviderRegistrar(reg, reflector, [PlainClass]);
    r.onModuleInit();

    expect(reg.getAll()).toHaveLength(0);
  });
});
