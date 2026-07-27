import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import type { RunOutcome } from '@tentacrawl/core';
import { ProxyServerEntity, ProxyUsageEntity } from '../data/entities';
import type { ProxyEndpoint, ProxyExtensionConfig } from '../data/schemas';

export interface ProxyAcquireInput {
  taskId: string;
  taskType: string;
  correlationId?: string;
  serverId?: string;
  rotation: ProxyExtensionConfig['rotation'];
}

export interface ProxyAssignment {
  server: string;
  username?: string;
  password?: string;
  serverId: string;
  endpointId: string;
  usageId: string;
}

export interface ProxyOutcomeOptions {
  error?: string;
  countBlockedAsFailure: boolean;
}

// avoids depending on the mongodb types directly
interface AtomicCollection {
  updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<unknown>;
}

@Injectable()
export class ProxyManagerService {
  private readonly logger = new Logger(ProxyManagerService.name);

  constructor(private readonly em: EntityManager) {}

  async acquire(input: ProxyAcquireInput): Promise<ProxyAssignment | null> {
    const em = this.em.fork();

    const servers = input.serverId
      ? await em.find(ProxyServerEntity, { id: input.serverId })
      : await em.find(ProxyServerEntity, { enabled: true });

    const candidates = servers.filter((s) => s.enabled && s.endpoints.length > 0);
    if (candidates.length === 0) {
      this.logger.warn(
        `No usable proxy server (serverId=${input.serverId ?? 'auto'} task=${input.taskId})`,
      );
      return null;
    }

    const { server, endpoint } = this.pick(candidates, input.rotation);

    const usage = em.create(ProxyUsageEntity, {
      serverId: server.id,
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      taskId: input.taskId,
      taskType: input.taskType,
      correlationId: input.correlationId,
    });
    await em.flush();

    // atomic: avoids a read-modify-write race on the embedded array
    await this.bumpEndpoint(
      em,
      server.id,
      endpoint.id,
      { timesUsed: 1 },
      { lastUsedAt: new Date() },
    );

    this.logger.log(
      `Proxy acquired: server=${server.name} endpoint=${endpoint.url} usage=${usage.id} task=${input.taskId}`,
    );

    return {
      server: endpoint.url,
      username: server.username,
      password: server.password,
      serverId: server.id,
      endpointId: endpoint.id,
      usageId: usage.id,
    };
  }

  async recordOutcome(
    usageId: string,
    outcome: RunOutcome,
    options: ProxyOutcomeOptions,
  ): Promise<void> {
    const em = this.em.fork();
    const usage = await em.findOne(ProxyUsageEntity, { id: usageId });
    if (!usage || usage.outcome) {
      return;
    }

    const finishedAt = new Date();
    usage.outcome = outcome;
    usage.error = options.error;
    usage.finishedAt = finishedAt;
    usage.durationMs = finishedAt.getTime() - usage.startedAt.getTime();

    const failed =
      outcome === 'ERROR' ||
      (outcome === 'BLOCKED' && options.countBlockedAsFailure);

    if (outcome === 'OK') {
      await this.bumpEndpoint(em, usage.serverId, usage.endpointId, { timesSucceeded: 1 });
    } else if (failed) {
      await this.bumpEndpoint(
        em,
        usage.serverId,
        usage.endpointId,
        { timesFailed: 1 },
        { lastFailedAt: finishedAt, lastError: options.error ?? outcome },
      );
    }

    await em.flush();
    this.logger.log(`Proxy usage recorded: usage=${usageId} outcome=${outcome}`);
  }

  // atomic positional update on a single embedded endpoint
  private async bumpEndpoint(
    em: EntityManager,
    serverId: string,
    endpointId: string,
    inc: Record<string, number>,
    set: Record<string, unknown> = {},
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    const incFields = prefixEndpointFields(inc);
    const setFields = prefixEndpointFields(set);
    if (Object.keys(incFields).length > 0) update.$inc = incFields;
    if (Object.keys(setFields).length > 0) update.$set = setFields;
    if (Object.keys(update).length === 0) return;

    const collection = em.getCollection(ProxyServerEntity) as unknown as AtomicCollection;
    await collection.updateOne({ _id: serverId, 'endpoints.id': endpointId }, update);
  }

  private pick(
    servers: ProxyServerEntity[],
    rotation: ProxyExtensionConfig['rotation'],
  ): { server: ProxyServerEntity; endpoint: ProxyEndpoint } {
    const flat = servers.flatMap((server) =>
      server.endpoints.map((endpoint) => ({ server, endpoint })),
    );

    if (rotation === 'random') {
      return flat[Math.floor(Math.random() * flat.length)];
    }

    // round-robin: least recently used first, never-used endpoints win
    return flat.reduce((best, current) => {
      const bestAt = best.endpoint.lastUsedAt?.getTime() ?? 0;
      const currentAt = current.endpoint.lastUsedAt?.getTime() ?? 0;
      return currentAt < bestAt ? current : best;
    });
  }
}

// { timesUsed: 1 } -> { 'endpoints.$.timesUsed': 1 }
function prefixEndpointFields<T>(fields: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[`endpoints.$.${key}`] = value;
  }
  return out;
}
