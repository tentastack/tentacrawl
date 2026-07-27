import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import type { ChallengerSelectionOption } from '@tentacrawl/core';
import { ProxyServerEntity, ProxyUsageEntity } from '../data/entities';
import type {
  CreateProxyServerDto,
  ListProxyServersQuery,
  ProxyEndpoint,
  ProxyEndpointInput,
  ProxyServerResponse,
  TestProxyEndpointDto,
  UpdateProxyServerDto,
} from '../data/schemas';

export interface TestCredentials {
  username?: string;
  password?: string;
}

export interface ProxyServerListResponse {
  data: ProxyServerResponse[];
  total: number;
}

// strips the password; callers only learn whether one is set
function toResponse(server: ProxyServerEntity): ProxyServerResponse {
  return {
    id: server.id,
    name: server.name,
    enabled: server.enabled,
    location: server.location,
    username: server.username,
    hasPassword: !!server.password,
    notes: server.notes,
    endpoints: server.endpoints,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  };
}

function newEndpoint(url: string): ProxyEndpoint {
  return {
    id: crypto.randomUUID(),
    url,
    timesUsed: 0,
    timesSucceeded: 0,
    timesFailed: 0,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// exported for unit tests
export function buildProxyServerFilter(
  query: Pick<ListProxyServersQuery, 'name' | 'endpoint' | 'enabled' | 'location' | 'usage'>,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const name = query.name?.trim();
  if (name) {
    filter.name = new RegExp(escapeRegex(name), 'i');
  }

  const endpoint = query.endpoint?.trim();
  if (endpoint) {
    filter['endpoints.url'] = new RegExp(escapeRegex(endpoint), 'i');
  }

  if (query.enabled !== undefined) {
    filter.enabled = query.enabled;
  }

  if (query.location) {
    filter.location = query.location;
  }

  if (query.usage === 'used') {
    filter['endpoints.timesUsed'] = { $gt: 0 };
  } else if (query.usage === 'unused') {
    filter['endpoints.timesUsed'] = { $not: { $gt: 0 } };
  } else if (query.usage === 'failing') {
    filter['endpoints.timesFailed'] = { $gt: 0 };
  }

  return filter;
}

@Injectable()
export class ProxyServerService {
  constructor(private readonly em: EntityManager) {}

  async list(query: ListProxyServersQuery): Promise<ProxyServerListResponse> {
    const [data, total] = await this.em.findAndCount(
      ProxyServerEntity,
      buildProxyServerFilter(query),
      {
        limit: query.limit,
        offset: query.offset,
        orderBy: { [query.sort]: query.order === 'asc' ? 'ASC' : 'DESC' },
      },
    );
    return { data: data.map(toResponse), total };
  }

  async getOne(id: string): Promise<ProxyServerResponse> {
    return toResponse(await this.findById(id));
  }

  async locations(): Promise<string[]> {
    const servers = await this.em.find(
      ProxyServerEntity,
      { location: { $ne: null } },
      { fields: ['location'] },
    );
    return [...new Set(servers.map((s) => s.location!).filter(Boolean))].sort();
  }

  async findById(id: string): Promise<ProxyServerEntity> {
    const server = await this.em.findOne(ProxyServerEntity, { id });
    if (!server) {
      throw new NotFoundException(`Proxy server ${id} not found`);
    }
    return server;
  }

  // the password field is never sent to the client, so a blank password on a
  // "test this endpoint" request for an already-saved server (and an
  // unchanged username) means "use what's on file", not "no password"
  async resolveTestCredentials(dto: TestProxyEndpointDto): Promise<TestCredentials> {
    const asIs = { username: dto.username, password: dto.password };
    if (dto.password?.trim() || !dto.serverId) {
      return asIs;
    }

    const server = await this.em.findOne(ProxyServerEntity, { id: dto.serverId });
    if (!server) {
      return asIs;
    }

    const usernameUnchanged = !dto.username?.trim() || dto.username === server.username;
    return usernameUnchanged ? { username: server.username, password: server.password } : asIs;
  }

  async create(dto: CreateProxyServerDto): Promise<ProxyServerEntity> {
    const server = this.em.create(ProxyServerEntity, {
      name: dto.name,
      enabled: dto.enabled,
      location: dto.location,
      username: dto.username,
      password: dto.password,
      notes: dto.notes,
      endpoints: dto.endpoints.map((endpoint) => newEndpoint(endpoint.url)),
    });
    await this.em.flush();
    return server;
  }

  async update(id: string, dto: UpdateProxyServerDto): Promise<ProxyServerEntity> {
    const server = await this.findById(id);
    server.name = dto.name;
    server.enabled = dto.enabled;
    server.location = dto.location;
    server.username = dto.username;
    // blank means keep the existing password
    if (dto.password !== undefined) {
      server.password = dto.password;
    }
    server.notes = dto.notes;
    server.endpoints = this.mergeEndpoints(server.endpoints, dto.endpoints);
    await this.em.flush();
    return server;
  }

  async remove(id: string): Promise<void> {
    const server = await this.findById(id);
    this.em.remove(server);
    await this.em.flush();
  }

  async options(): Promise<ChallengerSelectionOption[]> {
    const servers = await this.em.find(ProxyServerEntity, {}, { orderBy: { name: 'asc' } });
    return servers.map((server) => {
      const endpoints = `${server.endpoints.length} endpoint${server.endpoints.length === 1 ? '' : 's'}`;
      return {
        value: server.id,
        label: server.name,
        description: server.location ? `${endpoints} - ${server.location}` : endpoints,
        disabled: !server.enabled,
      };
    });
  }

  async usage(serverId: string, limit = 50): Promise<ProxyUsageEntity[]> {
    await this.findById(serverId);
    return this.em.find(
      ProxyUsageEntity,
      { serverId },
      { orderBy: { startedAt: 'desc' }, limit },
    );
  }

  // matches by id keep their usage counters; unmatched rows start fresh
  private mergeEndpoints(
    existing: ProxyEndpoint[],
    inputs: ProxyEndpointInput[],
  ): ProxyEndpoint[] {
    const byId = new Map(existing.map((endpoint) => [endpoint.id, endpoint]));
    return inputs.map((input) => {
      const previous = input.id ? byId.get(input.id) : undefined;
      return previous ? { ...previous, url: input.url } : newEndpoint(input.url);
    });
  }
}
