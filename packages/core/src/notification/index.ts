export const NOTIFICATION_SEVERITY = ['info', 'success', 'warning', 'error'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITY)[number];

export const NOTIFICATION_SOURCE = ['scraper', 'crawler', 'worker', 'system'] as const;
export type NotificationSource = (typeof NOTIFICATION_SOURCE)[number];

export interface CreateNotificationInput {
  eventType: string;
  source: NotificationSource;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPublisher {
  publish(input: CreateNotificationInput): Promise<void>;
}

export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');