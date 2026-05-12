import { Injectable } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export interface ProxyProviderInfo {
  id: string;
  name: string;
  description: string;
  configSchema: ZodSchema;
}

@Injectable()
export class ProxyProviderRegistry {
  private readonly providers = new Map<string, ProxyProviderInfo>();

  register(info: ProxyProviderInfo): void {
    this.providers.set(info.id, info);
  }

  getProvider(id: string): ProxyProviderInfo | undefined {
    return this.providers.get(id);
  }

  getAll(): ProxyProviderInfo[] {
    return [...this.providers.values()];
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  isManagedModeAvailable(): boolean {
    return this.providers.size > 0;
  }
}
