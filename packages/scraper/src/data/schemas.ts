import { z } from 'zod';
import {
  artefactFormatSchema,
  DEFAULT_ARTEFACT_FORMATS,
  networkPolicySchema,
  artefactResultSchema,
  traceSchema,
  runEnvSchema,
  taskStatusSchema,
  runOutcomeSchema,
} from '@tentacrawl/core/schema';
import { isHttpUrl } from '@tentacrawl/core/url';

export { taskStatusSchema };
export type { TaskStatus } from '@tentacrawl/core/schema';

const httpUrlString = z.string().url().refine(
  (value) => isHttpUrl(value),
  { message: 'URL must use http or https' },
);

const optionalTrimmedString = (schema: z.ZodString) => z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  },
  schema.optional(),
);

export const createScrapeDto = z.object({
  url: httpUrlString,
  artefacts: z.array(artefactFormatSchema).min(1).default([...DEFAULT_ARTEFACT_FORMATS]),
  networkPolicy: networkPolicySchema.default({ mode: 'none' }),
  timeout: z.number().int().positive().max(120_000).default(30_000),
  waitFor: z.enum(['load', 'domcontentloaded', 'networkidle']).default('domcontentloaded'),
  locale: optionalTrimmedString(z.string().min(2).max(10)),
  timezone: optionalTrimmedString(z.string().min(1)),
  headers: z.record(z.string()).optional(),
  dsl: z.string().optional(),
  async: z.boolean().default(false),
});
export type CreateScrapeDto = z.infer<typeof createScrapeDto>;

export const scrapePayloadSchema = z.object({
  taskId: z.string().min(1),
  url: httpUrlString,
  artefacts: z.array(artefactFormatSchema).min(1),
  networkPolicy: networkPolicySchema,
  timeout: z.number().int().positive(),
  waitFor: z.enum(['load', 'domcontentloaded', 'networkidle']),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  headers: z.record(z.string()).optional(),
  dslYaml: z.string().optional(),
});
export type ScrapePayload = z.infer<typeof scrapePayloadSchema>;

export const scrapeResultSchema = z.object({
  outcome: runOutcomeSchema,
  artefacts: artefactResultSchema,
  trace: traceSchema.optional(),
  env: runEnvSchema.optional(),
  durationMs: z.number().nonnegative(),
  httpStatus: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});
export type ScrapeResult = z.infer<typeof scrapeResultSchema>;

export const scrapeResponseSchema = z.object({
  id: z.string(),
  status: taskStatusSchema,
  url: httpUrlString,
  origin: httpUrlString,
  result: scrapeResultSchema.optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});
export type ScrapeResponse = z.infer<typeof scrapeResponseSchema>;

export const scrapeListItemSchema = z.object({
  id: z.string(),
  status: taskStatusSchema,
  url: z.string().url(),
  durationMs: z.number().nonnegative().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});
export type ScrapeListItem = z.infer<typeof scrapeListItemSchema>;
