import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import { ChallengerRegistry, challengerExtensionKey } from '@tentacrawl/core';
import { ChallengerRegistrationEntity } from '../data/entities';

@Injectable()
export class ChallengerRegistrationSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChallengerRegistrationSyncService.name);

  constructor(
    private readonly registry: ChallengerRegistry,
    private readonly em: EntityManager,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const extensions = this.registry.getExtensions();

    // a worker that loaded zero extensions must not archive other workers' registrations
    if (extensions.length === 0) {
      this.logger.warn(
        'No challenger extensions loaded; skipping registration sync to avoid archiving live registrations.',
      );
      return;
    }

    const em = this.em.fork();
    const now = new Date();
    const activeIds = new Set<string>();

    for (const extension of extensions) {
      const id = challengerExtensionKey(extension);
      activeIds.add(id);
      try {
        const existing = await em.findOne(ChallengerRegistrationEntity, { id });
        if (existing) {
          existing.status = 'active';
          existing.version = extension.version;
          existing.priority = extension.priority;
          existing.capabilities = extension.capabilities;
          existing.targets = extension.targets;
          existing.selection = extension.selection;
          existing.hasConfigSchema = !!extension.configSchema;
          existing.lastSeenAt = now;
        } else {
          em.create(ChallengerRegistrationEntity, {
            id,
            status: 'active',
            moduleId: extension.moduleId,
            extensionId: extension.extensionId,
            version: extension.version,
            priority: extension.priority,
            capabilities: extension.capabilities,
            targets: extension.targets,
            selection: extension.selection,
            hasConfigSchema: !!extension.configSchema,
            registeredAt: now,
            lastSeenAt: now,
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to sync challenger registration ${id}: ${err}`);
      }
    }

    try {
      await em.flush();
    } catch (err) {
      this.logger.warn(`Failed to persist challenger registrations: ${err}`);
    }

    // archive rather than delete: preserves history and lets an operator purge explicitly
    try {
      const archived = await em.fork().nativeUpdate(
        ChallengerRegistrationEntity,
        { id: { $nin: [...activeIds] }, status: { $ne: 'archived' } },
        { status: 'archived' },
      );
      if (archived > 0) {
        this.logger.log(`Archived ${archived} challenger registration(s) no longer loaded.`);
      }
    } catch (err) {
      this.logger.warn(`Failed to archive stale challenger registrations: ${err}`);
    }
  }
}
