import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import type { ChallengerCapability } from '@tentacrawl/core';
import {
  ChallengerConfigEntity,
  ChallengerRegistrationEntity,
  ChallengerSignalEntity,
} from '../data/entities';
import type {
  ChallengerHealth,
  ChallengerListItem,
  ChallengerSignalItem,
} from '../data/schemas';

@Injectable()
export class ChallengerApiService {
  constructor(private readonly em: EntityManager) {}

  async list(capability?: string): Promise<ChallengerListItem[]> {
    const [registrations, configs] = await Promise.all([
      this.em.find(
        ChallengerRegistrationEntity,
        capability ? { capabilities: capability as ChallengerCapability } : {}, // unknown values just match nothing
      ),
      this.em.findAll(ChallengerConfigEntity),
    ]);
    const configMap = new Map(configs.map((c) => [c.id, c]));

    const items = await Promise.all(
      registrations.map(async (reg) => {
        const signalCount = await this.em.count(ChallengerSignalEntity, {
          extensionId: reg.id,
        });
        return this.toListItem(reg, configMap.get(reg.id), signalCount);
      }),
    );
    return items.sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<ChallengerListItem> {
    const reg = await this.findRegistration(id);
    const config = await this.em.findOne(ChallengerConfigEntity, { id });
    const signalCount = await this.em.count(ChallengerSignalEntity, {
      extensionId: id,
    });
    return this.toListItem(reg, config ?? undefined, signalCount);
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.findRegistration(id);
    const config = await this.em.findOne(ChallengerConfigEntity, { id });
    if (config) {
      config.enabled = enabled;
    } else {
      this.em.create(ChallengerConfigEntity, { id, enabled });
    }
    await this.em.flush();
  }

  async getConfig(id: string): Promise<Record<string, unknown>> {
    await this.findRegistration(id);
    const config = await this.em.findOne(ChallengerConfigEntity, { id });
    return config?.config ?? {};
  }

  async setConfig(id: string, value: Record<string, unknown>): Promise<void> {
    await this.findRegistration(id);
    const config = await this.em.findOne(ChallengerConfigEntity, { id });
    if (config) {
      config.config = value;
    } else {
      this.em.create(ChallengerConfigEntity, { id, config: value });
    }
    await this.em.flush();
  }

  // only archived extensions can be purged
  async purge(id: string): Promise<void> {
    const reg = await this.findRegistration(id);
    if (reg.status === 'active') {
      throw new BadRequestException(
        `Challenger extension ${id} is active; remove it from modules.config.ts and restart the worker before purging.`,
      );
    }
    await this.em.nativeDelete(ChallengerRegistrationEntity, { id });
    await this.em.nativeDelete(ChallengerConfigEntity, { id });
    await this.em.nativeDelete(ChallengerSignalEntity, { extensionId: id });
  }

  async health(id: string): Promise<ChallengerHealth> {
    const reg = await this.findRegistration(id);
    const signalCount = await this.em.count(ChallengerSignalEntity, {
      extensionId: id,
    });
    return {
      id: reg.id,
      lastRunAt: reg.lastRunAt?.toISOString(),
      lastError: reg.lastError,
      signalCount,
    };
  }

  async signals(id: string, limit = 50): Promise<ChallengerSignalItem[]> {
    await this.findRegistration(id);
    const signals = await this.em.find(
      ChallengerSignalEntity,
      { extensionId: id },
      { orderBy: { createdAt: 'desc' }, limit },
    );
    return signals.map((s) => ({
      id: s.id,
      extensionId: s.extensionId,
      taskId: s.taskId,
      correlationId: s.correlationId,
      signalType: s.signalType,
      severity: s.severity,
      source: s.source,
      annotations: s.annotations,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async runSignals(taskId: string): Promise<ChallengerSignalItem[]> {
    const signals = await this.em.find(
      ChallengerSignalEntity,
      { $or: [{ taskId }, { correlationId: taskId }] },
      { orderBy: { createdAt: 'asc' } },
    );
    return signals.map((s) => ({
      id: s.id,
      extensionId: s.extensionId,
      taskId: s.taskId,
      correlationId: s.correlationId,
      signalType: s.signalType,
      severity: s.severity,
      source: s.source,
      annotations: s.annotations,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  private async findRegistration(id: string): Promise<ChallengerRegistrationEntity> {
    const reg = await this.em.findOne(ChallengerRegistrationEntity, { id });
    if (!reg) {
      throw new NotFoundException(`Challenger extension ${id} not found`);
    }
    return reg;
  }

  private toListItem(
    reg: ChallengerRegistrationEntity,
    config: ChallengerConfigEntity | undefined,
    signalCount: number,
  ): ChallengerListItem {
    return {
      id: reg.id,
      status: reg.status,
      moduleId: reg.moduleId,
      extensionId: reg.extensionId,
      version: reg.version,
      priority: reg.priority,
      capabilities: reg.capabilities,
      targets: reg.targets,
      selection: reg.selection,
      hasConfigSchema: reg.hasConfigSchema,
      enabled: config?.enabled ?? true,
      registeredAt: reg.registeredAt.toISOString(),
      lastSeenAt: reg.lastSeenAt.toISOString(),
      lastRunAt: reg.lastRunAt?.toISOString(),
      lastError: reg.lastError,
      signalCount,
    };
  }
}
