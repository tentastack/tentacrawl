import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntityManager } from '@mikro-orm/mongodb';
import type { ProxyProvider } from '../provider/proxy-provider.interface';
import { ProxyPoolEntity, ProxyLeaseEntity } from '../data/entities';
import {
  PROXY_PROVIDER_META_KEY,
  PROXY_PROVIDERS_TOKEN,
  type ProxyProviderMeta,
} from '../provider/proxy-provider.decorator';

export interface ProxyAssignment {
  server: string;
  username?: string;
  password?: string;
  sessionId?: string;
  leaseId: string;
}

interface ProviderFactory {
  meta: ProxyProviderMeta;
  fromPoolConfig: (raw: Record<string, unknown>) => ProxyProvider;
}

@Injectable()
export class ProxyManagerService implements OnModuleInit {
  private readonly logger = new Logger(ProxyManagerService.name);
  private readonly providers = new Map<string, ProxyProvider>();
  private readonly factories = new Map<string, ProviderFactory>();

  constructor(
    private readonly em: EntityManager,
    private readonly reflector: Reflector,
    @Inject(PROXY_PROVIDERS_TOKEN) private readonly providerClasses: Function[],
  ) {}

  async onModuleInit(): Promise<void> {
    this.discoverFactories();
    await this.loadProviders();
  }

  private discoverFactories(): void {
    for (const cls of this.providerClasses) {
      const meta = this.reflector.get<ProxyProviderMeta>(
        PROXY_PROVIDER_META_KEY,
        cls,
      );
      if (!meta) continue;

      if (typeof (cls as any).fromPoolConfig !== 'function') {
        this.logger.warn(
          `Provider '${meta.id}' does not implement static fromPoolConfig(), skipping`,
        );
        continue;
      }

      this.factories.set(meta.id, {
        meta,
        fromPoolConfig: (raw) => (cls as any).fromPoolConfig(raw),
      });
      this.logger.log(`Discovered provider factory: ${meta.id}`);
    }
  }

  async acquireProxy(taskId: string, poolId: string): Promise<ProxyAssignment | null> {
    let provider = this.providers.get(poolId);
    if (!provider) {
      // pool may have been created after boot; try loading on demand
      const pool = await this.em.findOne(ProxyPoolEntity, poolId);
      if (!pool) {
        this.logger.warn(`Proxy pool ${poolId} not found`);
        return null;
      }
      provider = this.createProvider(pool);
      if (!provider) {
        this.logger.warn(`No factory for provider '${pool.provider}' (pool=${poolId})`);
        return null;
      }
      this.providers.set(poolId, provider);
    }

    const session = await provider.acquireSession();

    const lease = this.em.create(ProxyLeaseEntity, {
      poolId,
      taskId,
      sessionId: session.sessionId,
      status: 'ACTIVE',
    });
    await this.em.flush();

    this.logger.log(`Proxy acquired: lease=${lease.id} session=${session.sessionId} task=${taskId}`);

    return {
      server: session.endpoint.server,
      username: session.endpoint.username,
      password: session.endpoint.password,
      sessionId: session.sessionId,
      leaseId: lease.id,
    };
  }

  async releaseProxy(leaseId: string, reason: 'completed' | 'error' = 'completed'): Promise<void> {
    const lease = await this.em.findOne(ProxyLeaseEntity, leaseId);
    if (!lease) return;

    if (lease.sessionId) {
      const provider = this.providers.get(lease.poolId);
      if (provider) {
        await provider.releaseSession(lease.sessionId);
      }
    }

    lease.status = 'RELEASED';
    lease.releasedAt = new Date();
    await this.em.flush();

    this.logger.log(`Proxy released: lease=${leaseId} reason=${reason}`);
  }

  private async loadProviders(): Promise<void> {
    const pools = await this.em.findAll(ProxyPoolEntity);
    for (const pool of pools) {
      const provider = this.createProvider(pool);
      if (provider) {
        this.providers.set(pool.id, provider);
        this.logger.log(`Loaded proxy provider: ${pool.provider} pool=${pool.id}`);
      }
    }
  }

  private createProvider(pool: ProxyPoolEntity): ProxyProvider | undefined {
    const factory = this.factories.get(pool.provider);
    if (!factory) {
      this.logger.warn(`Unknown proxy provider: ${pool.provider}`);
      return undefined;
    }
    return factory.fromPoolConfig(pool.providerConfig);
  }
}
