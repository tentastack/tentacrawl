export const ACTIVITY_LOG_SEVERITY = ['info', 'success', 'warning', 'error'] as const;
export type ActivityLogSeverity = (typeof ACTIVITY_LOG_SEVERITY)[number];

export const ACTIVITY_LOG_SOURCE = ['scraper', 'crawler', 'worker', 'system'] as const;
export type ActivityLogSource = (typeof ACTIVITY_LOG_SOURCE)[number];

export interface CreateActivityLogInput {
  eventType: string;
  source: ActivityLogSource;
  severity: ActivityLogSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityLogRecorder {
  record(input: CreateActivityLogInput): Promise<void>;
}

export const ACTIVITY_LOG_RECORDER = Symbol('ACTIVITY_LOG_RECORDER');