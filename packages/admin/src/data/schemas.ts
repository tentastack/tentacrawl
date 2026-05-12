import { z } from 'zod';

export const workerHealthSchema = z.enum(['healthy', 'stale', 'offline']);
export type WorkerHealth = z.infer<typeof workerHealthSchema>;

export const queueSnapshotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  concurrency: z.number().int().positive(),
  waiting: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
});
export type QueueSnapshot = z.infer<typeof queueSnapshotSchema>;

export const workerSnapshotSchema = z.object({
  workerId: z.string().min(1),
  hostname: z.string().min(1),
  pid: z.number().int().positive(),
  port: z.number().int().positive(),
  version: z.string().min(1),
  startedAt: z.string().datetime(),
  uptimeMs: z.number().int().nonnegative(),
  supportedQueues: z.array(z.string().min(1)).default([]),
  supportedModules: z.array(z.string().min(1)).default([]),
});
export type WorkerSnapshot = z.infer<typeof workerSnapshotSchema>;

export const workerSummarySchema = workerSnapshotSchema.extend({
  lastHeartbeatAt: z.string().datetime(),
  status: workerHealthSchema,
  freshnessMs: z.number().int().nonnegative(),
});
export type WorkerSummary = z.infer<typeof workerSummarySchema>;

export const activityLogItemSchema = z.object({
  id: z.string().min(1),
  eventType: z.string().min(1),
  source: z.enum(['scraper', 'crawler', 'worker', 'system']),
  severity: z.enum(['info', 'success', 'warning', 'error']),
  title: z.string().min(1),
  message: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  workerId: z.string().optional(),
  correlationId: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type ActivityLogItem = z.infer<typeof activityLogItemSchema>;

export const activityLogListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(12),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type ActivityLogListQuery = z.infer<typeof activityLogListQuerySchema>;

export const activityLogListResponseSchema = z.object({
  data: z.array(activityLogItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type ActivityLogListResponse = z.infer<typeof activityLogListResponseSchema>;

export const dashboardOverviewSchema = z.object({
  stats: z.object({
    totalScrapes: z.number().int().nonnegative(),
    totalCrawls: z.number().int().nonnegative(),
    activeJobs: z.number().int().nonnegative(),
    activeWorkers: z.number().int().nonnegative(),
  }),
  queues: z.array(queueSnapshotSchema),
});
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;