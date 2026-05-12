import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProxyProviderRegistry } from '../provider/proxy-provider.registry';
import {
  PROXY_PROVIDER_META_KEY,
  PROXY_PROVIDERS_TOKEN,
} from '../provider/proxy-provider.decorator';

@Injectable()
export class ProxyProviderRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ProxyProviderRegistrar.name);

  constructor(
    private readonly registry: ProxyProviderRegistry,
    private readonly reflector: Reflector,
    @Inject(PROXY_PROVIDERS_TOKEN) private readonly providerClasses: Function[],
  ) {}

  onModuleInit(): void {
    for (const cls of this.providerClasses) {
      const meta = this.reflector.get(PROXY_PROVIDER_META_KEY, cls);
      if (!meta) continue;

      this.registry.register({
        id: meta.id,
        name: meta.name,
        description: meta.description,
        configSchema: meta.configSchema,
      });
      this.logger.log(`Registered proxy provider: ${meta.id}`);
    }
  }
}
