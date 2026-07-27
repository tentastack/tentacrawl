import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import type { ChallengerSignal } from '@tentacrawl/core';
import { ACTIVITY_LOG_RECORDER } from '@tentacrawl/core/activity';
import type { ActivityLogRecorder } from '@tentacrawl/core/activity';
import type { ChallengerRunSeed } from '@tentacrawl/browser';
import { ChallengerSignalEntity } from '../data/entities';

const SENSITIVE_KEY_PATTERN =
  /password|secret|token|cookie|authorization|credential|proxy/i;
const MAX_REDACT_DEPTH = 6;

// batched to avoid a fork+flush per signal under high-frequency observer emission
const FLUSH_INTERVAL_MS = 1_000;
const MAX_BATCH = 100;
const BUFFER_HARD_CAP = 2_000;

interface BufferedSignal {
  extensionId: string;
  taskId: string;
  correlationId?: string;
  signalType: string;
  severity: string;
  source?: string;
  evidence?: unknown;
  annotations?: Record<string, unknown>;
}

@Injectable()
export class ChallengerSignalBus implements OnModuleDestroy {
  private readonly logger = new Logger(ChallengerSignalBus.name);
  private readonly buffer: BufferedSignal[] = [];
  private flushTimer?: NodeJS.Timeout;
  private flushing = false;
  private dropped = 0;

  constructor(
    private readonly em: EntityManager,
    @Optional()
    @Inject(ACTIVITY_LOG_RECORDER)
    private readonly activityLogRecorder?: ActivityLogRecorder,
  ) {}

  publish(extensionKey: string, signal: ChallengerSignal, seed: ChallengerRunSeed): void {
    this.buffer.push({
      extensionId: extensionKey,
      taskId: seed.taskId,
      correlationId: seed.correlationId,
      signalType: signal.signalType,
      severity: signal.severity,
      source: signal.source,
      evidence: redactSensitive(signal.evidence),
      annotations: redactSensitive(signal.annotations) as
        | Record<string, unknown>
        | undefined,
    });

    // drop oldest under a persistence stall, rather than grow unbounded
    while (this.buffer.length > BUFFER_HARD_CAP) {
      this.buffer.shift();
      this.dropped += 1;
    }

    this.ensureTimer();
    if (this.buffer.length >= MAX_BATCH) {
      void this.flush();
    }

    if (signal.severity === 'error' && this.activityLogRecorder) {
      void this.activityLogRecorder
        .record({
          eventType: `challenger.signal.${signal.signalType}`,
          source: 'system',
          severity: 'error',
          title: 'Challenger signal',
          message: `${extensionKey} emitted ${signal.signalType}`,
          entityType: 'challenger-extension',
          entityId: extensionKey,
          correlationId: seed.correlationId ?? seed.taskId,
          workerId: seed.workerId,
          metadata: { taskId: seed.taskId, signalType: signal.signalType },
        })
        .catch(() => {});
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flush();
  }

  private ensureTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.flushTimer.unref();
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      const em = this.em.fork();
      for (const record of batch) {
        em.create(ChallengerSignalEntity, record);
      }
      await em.flush();
      if (this.dropped > 0) {
        this.logger.warn(
          `Dropped ${this.dropped} challenger signal(s) after exceeding the buffer cap`,
        );
        this.dropped = 0;
      }
    } catch (err) {
      // count as dropped rather than re-buffer, which could wedge on a persistent DB fault
      this.dropped += batch.length;
      this.logger.warn(`Failed to persist ${batch.length} challenger signal(s): ${err}`);
    } finally {
      this.flushing = false;
    }
  }
}

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_REDACT_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : redactSensitive(item, depth + 1);
    }
    return out;
  }
  return value;
}
