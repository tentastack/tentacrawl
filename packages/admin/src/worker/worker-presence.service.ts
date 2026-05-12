import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import { ConfigService } from '@nestjs/config';
import type { WorkerSnapshot } from '../data/schemas';
import * as os from 'node:os';
import { ADMIN_EVENT } from '../event';
import { loadAdminConfig } from '../config';
import { WorkerInstanceEntity } from '../data/entities';
import { ActivityLogRecorderService } from './activity-log-recorder.service';

@Injectable()
export class WorkerPresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerPresenceService.name);
  private readonly hostname = os.hostname();
  private readonly pid = process.pid;
  private readonly version = process.env['npm_package_version'] ?? '0.1.0';
  private readonly startedAt = new Date();
  private readonly config;
  private readonly port: number;
  private readonly workerId: string;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
    private readonly activityLogRecorderService: ActivityLogRecorderService,
  ) {
    this.config = loadAdminConfig(this.configService);
    this.port = Number(this.configService.get('PORT', 3001));
    this.workerId = `${this.hostname}:${this.pid}:${this.startedAt.getTime()}`;
  }

  async onModuleInit(): Promise<void> {
    await this.persistHeartbeat();
    await this.activityLogRecorderService.record({
      eventType: ADMIN_EVENT.WORKER_REGISTERED,
      source: 'worker',
      severity: 'success',
      title: 'Worker registered',
      message: `Worker ${this.hostname}:${this.pid} is online`,
      entityType: 'worker',
      entityId: this.workerId,
      workerId: this.workerId,
      metadata: {
        hostname: this.hostname,
        pid: this.pid,
        port: this.port,
      },
    });

    this.heartbeatTimer = setInterval(() => {
      void this.persistHeartbeat();
    }, this.config.ADMIN_WORKER_HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    await this.activityLogRecorderService.record({
      eventType: ADMIN_EVENT.WORKER_STOPPED,
      source: 'worker',
      severity: 'warning',
      title: 'Worker stopped',
      message: `Worker ${this.hostname}:${this.pid} stopped`,
      entityType: 'worker',
      entityId: this.workerId,
      workerId: this.workerId,
    });
  }

  getSnapshot(): WorkerSnapshot {
    return {
      workerId: this.workerId,
      hostname: this.hostname,
      pid: this.pid,
      port: this.port,
      version: this.version,
      startedAt: this.startedAt.toISOString(),
      uptimeMs: Date.now() - this.startedAt.getTime(),
      supportedQueues: this.config.ADMIN_WORKER_SUPPORTED_QUEUES,
      supportedModules: this.config.ADMIN_WORKER_SUPPORTED_MODULES,
    };
  }

  private async persistHeartbeat(): Promise<void> {
    const existing = await this.em.findOne(WorkerInstanceEntity, { workerId: this.workerId });
    if (existing) {
      existing.lastHeartbeatAt = new Date();
      existing.port = this.port;
      existing.version = this.version;
      existing.supportedQueues = this.config.ADMIN_WORKER_SUPPORTED_QUEUES;
      existing.supportedModules = this.config.ADMIN_WORKER_SUPPORTED_MODULES;
      await this.em.flush();
      return;
    }

    const record = this.em.create(WorkerInstanceEntity, {
      workerId: this.workerId,
      hostname: this.hostname,
      pid: this.pid,
      port: this.port,
      version: this.version,
      startedAt: this.startedAt,
      lastHeartbeatAt: new Date(),
      supportedQueues: this.config.ADMIN_WORKER_SUPPORTED_QUEUES,
      supportedModules: this.config.ADMIN_WORKER_SUPPORTED_MODULES,
    });

    await this.em.persistAndFlush(record);
    this.logger.log(`Worker heartbeat registered for ${this.workerId}`);
  }
}