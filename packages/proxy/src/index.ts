import type { ModuleInfo } from '@tentacrawl/core';

export const metadata: ModuleInfo = {
  name: 'proxy',
  title: 'Proxy Management',
  version: '0.2.0',
  description: 'Manually defined proxy servers with shared credentials, endpoint rotation, and usage tracking',
  requires: ['challenger'],
  navigation: {
    label: 'Proxy Servers',
    icon: 'Network',
    path: '/proxy',
    order: 10,
    parent: '/extensions',
  },
  routes: [
    { path: 'proxy', page: 'proxy-server-list', title: 'Proxy Servers' },
    { path: 'proxy/new', page: 'proxy-server-create', title: 'New Proxy Server' },
    { path: 'proxy/:id', page: 'proxy-server-detail', title: 'Proxy Server Detail' },
  ],
};

export { ProxyModule } from './proxy.module';
export { ProxyChallengerExtension } from './worker/proxy.challenger';
export { ProxyManagerService } from './worker/proxy-manager.service';
export type {
  ProxyAcquireInput,
  ProxyAssignment,
  ProxyOutcomeOptions,
} from './worker/proxy-manager.service';
export {
  createProxyServerDto,
  updateProxyServerDto,
  listProxyServersQuerySchema,
  proxyServerSchema,
  proxyEndpointSchema,
  proxyEndpointInputSchema,
  proxyLocationSchema,
  proxyUsageSchema,
  proxyExtensionConfigSchema,
  PROXY_ROTATIONS,
  PROXY_SERVER_SORTS,
  PROXY_USAGE_FILTERS,
} from './data/schemas';
export type {
  ProxyServer,
  ProxyEndpoint,
  ProxyEndpointInput,
  ProxyUsage,
  CreateProxyServerDto,
  UpdateProxyServerDto,
  ListProxyServersQuery,
  ProxyExtensionConfig,
} from './data/schemas';
