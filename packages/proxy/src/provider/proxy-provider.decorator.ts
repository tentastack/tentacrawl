import { SetMetadata } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export interface ProxyProviderMeta {
  id: string;
  name: string;
  description: string;
  configSchema: ZodSchema;
}

export const PROXY_PROVIDER_META_KEY = 'PROXY_PROVIDER_META';

export const PROXY_PROVIDERS_TOKEN = 'PROXY_PROVIDERS';

export function ProxyProviderMeta(meta: ProxyProviderMeta): ClassDecorator {
  return SetMetadata(PROXY_PROVIDER_META_KEY, meta);
}
