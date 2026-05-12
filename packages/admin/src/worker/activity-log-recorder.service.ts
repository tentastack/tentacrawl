import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import type { ActivityLogRecorder, CreateActivityLogInput } from '@tentacrawl/core/activity';
import { ActivityLogEntity } from '../data/entities';

@Injectable()
export class ActivityLogRecorderService implements ActivityLogRecorder {
  private readonly logger = new Logger(ActivityLogRecorderService.name);

  constructor(private readonly em: EntityManager) {}

  async record(input: CreateActivityLogInput): Promise<void> {
    try {
      const event = this.em.create(ActivityLogEntity, input);
      await this.em.persistAndFlush(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to persist activity log ${input.eventType}: ${message}`);
    }
  }
}