import type { ModuleInfo } from '@tentacrawl/core';

export const metadata: ModuleInfo = {
  name: 'proxy',
  title: 'Proxy Management',
  version: '0.1.0',
  description: 'Proxy pool management with provider adapters and lease lifecycle',
};

export { ProxyModule } from './proxy.module';
export type { ProxyAssignment } from './worker/proxy-manager.service';
export type { ProxyProvider, ProxySession, ProxyEndpoint, ProxyProviderFactory, AcquireOptions } from './provider/proxy-provider.interface';
export { ProxyProviderMeta, PROXY_PROVIDERS_TOKEN, PROXY_PROVIDER_META_KEY } from './provider/proxy-provider.decorator';
export type { ProxyProviderMeta as ProxyProviderMetaType } from './provider/proxy-provider.decorator';
export { ProxyProviderRegistry } from './provider/proxy-provider.registry';
export type { ProxyProviderInfo } from './provider/proxy-provider.registry';
export { BrightDataProvider } from './provider/brightdata.provider';
export type { BrightDataConfig } from './provider/brightdata.provider';
export { brightdataPoolConfigSchema } from './provider/brightdata.config';
export type { BrightDataPoolConfig } from './provider/brightdata.config';
