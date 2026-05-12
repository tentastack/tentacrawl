import { z } from 'zod';

export const notificationItemSchema = z.object({
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
  readAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const notificationIdParamSchema = z.object({
  id: z.string().min(1),
});
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;