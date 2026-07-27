import { z } from 'zod';

export const challengerTargetSchema = z.object({
  hostnames: z.array(z.string()).optional(),
  origins: z.array(z.string()).optional(),
  urlPatterns: z.array(z.string()).optional(),
  taskTypes: z.array(z.enum(['scrape', 'crawl-page'])).optional(),
  metadata: z.record(z.string()).optional(),
});

export const challengerSelectionSchema = z.object({
  capability: z.string(),
  optionsPath: z.string(),
  autoLabel: z.string().optional(),
});

export const challengerSelectionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
});
export type ChallengerSelectionOptionItem = z.infer<typeof challengerSelectionOptionSchema>;

export const challengerListItemSchema = z.object({
  id: z.string(),
  status: z.enum(['active', 'archived']),
  moduleId: z.string(),
  extensionId: z.string(),
  version: z.string(),
  priority: z.number().optional(),
  capabilities: z.array(z.string()),
  targets: z.array(challengerTargetSchema).optional(),
  selection: challengerSelectionSchema.optional(),
  hasConfigSchema: z.boolean(),
  enabled: z.boolean(),
  registeredAt: z.string(),
  lastSeenAt: z.string(),
  lastRunAt: z.string().optional(),
  lastError: z.string().optional(),
  signalCount: z.number(),
});
export type ChallengerListItem = z.infer<typeof challengerListItemSchema>;

export const setChallengerEnabledDto = z.object({
  enabled: z.boolean(),
});
export type SetChallengerEnabledDto = z.infer<typeof setChallengerEnabledDto>;

export const setChallengerConfigDto = z.object({
  config: z.record(z.unknown()),
});
export type SetChallengerConfigDto = z.infer<typeof setChallengerConfigDto>;

export const challengerSignalItemSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  taskId: z.string(),
  correlationId: z.string().optional(),
  signalType: z.string(),
  severity: z.string(),
  source: z.string().optional(),
  annotations: z.record(z.unknown()).optional(),
  createdAt: z.string(),
});
export type ChallengerSignalItem = z.infer<typeof challengerSignalItemSchema>;

export const challengerHealthSchema = z.object({
  id: z.string(),
  lastRunAt: z.string().optional(),
  lastError: z.string().optional(),
  signalCount: z.number(),
});
export type ChallengerHealth = z.infer<typeof challengerHealthSchema>;
