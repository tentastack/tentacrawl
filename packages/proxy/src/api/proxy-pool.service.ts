import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import { ProxyProviderRegistry } from '../provider/proxy-provider.registry';
import {
  createProxyPoolDto,
  CreateProxyPoolDto,
  updateProxyPoolDto,
  UpdateProxyPoolDto,
} from '../data/schemas';
import { ProxyPoolEntity, ProxyLeaseEntity } from '../data/entities';

@Injectable()
export class ProxyPoolService {
  private readonly logger = new Logger(ProxyPoolService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly registry: ProxyProviderRegistry,
  ) {}

  async findAll(): Promise<ProxyPoolEntity[]> {
    return this.em.findAll(ProxyPoolEntity);
  }

  async findById(id: string): Promise<ProxyPoolEntity> {
    const pool = await this.em.findOne(ProxyPoolEntity, id);
    if (!pool) {
      throw new NotFoundException(`Proxy pool ${id} not found`);
    }
    return pool;
  }

  async create(dto: CreateProxyPoolDto): Promise<ProxyPoolEntity> {
    const validated = createProxyPoolDto.parse(dto);
    this.validateProvider(validated.provider);
    this.validateProviderConfig(validated.provider, validated.providerConfig);

    const pool = this.em.create(ProxyPoolEntity, {
      name: validated.name,
      provider: validated.provider,
      providerConfig: validated.providerConfig,
    });

    await this.em.flush();
    this.logger.log(`Proxy pool ${pool.id} created: ${pool.name} (${pool.provider})`);
    return pool;
  }

  async update(id: string, dto: UpdateProxyPoolDto): Promise<ProxyPoolEntity> {
    const validated = updateProxyPoolDto.parse(dto);
    const pool = await this.findById(id);

    const provider = validated.provider ?? pool.provider;
    if (validated.provider) {
      this.validateProvider(provider);
    }
    if (validated.providerConfig) {
      this.validateProviderConfig(provider, validated.providerConfig);
    }

    this.em.assign(pool, validated);
    await this.em.flush();
    this.logger.log(`Proxy pool ${pool.id} updated`);
    return pool;
  }

  async remove(id: string): Promise<void> {
    const pool = await this.findById(id);

    const activeLeases = await this.em.count(ProxyLeaseEntity, {
      poolId: id,
      status: 'ACTIVE',
    });
    if (activeLeases > 0) {
      throw new BadRequestException(
        `Cannot delete pool ${id}: ${activeLeases} active leases`,
      );
    }

    this.em.remove(pool);
    await this.em.flush();
    this.logger.log(`Proxy pool ${id} deleted`);
  }

  private validateProvider(provider: string): void {
    if (!this.registry.has(provider)) {
      const available = this.registry.getAll().map((p) => p.id);
      throw new BadRequestException(
        `Unknown proxy provider '${provider}'. Available: ${available.join(', ') || 'none'}`,
      );
    }
  }

  private validateProviderConfig(provider: string, config: Record<string, unknown>): void {
    const info = this.registry.getProvider(provider);
    if (!info) return;

    const result = info.configSchema.safeParse(config);
    if (!result.success) {
      throw new BadRequestException(
        `Invalid config for provider '${provider}': ${result.error.message}`,
      );
    }
  }
}
