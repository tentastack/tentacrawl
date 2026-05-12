import { z } from 'zod';
import {
  artefactFormatSchema,
  DEFAULT_ARTEFACT_FORMATS,
  networkPolicySchema,
  artefactResultSchema,
  crawlStatusSchema,
  crawlPageStatusSchema,
  runOutcomeSchema,
  runEnvSchema,
} from '@tentacrawl/core/schema';
import { isHttpUrl } from '@tentacrawl/core/url';

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

const httpUrlString = z.string().url().refine(
  (value) => isHttpUrl(value),
  { message: 'URL must use http or https' },
);

export const createCrawlDto = z.object({
  url: httpUrlString,
  maxDepth: z.number().int().min(0).max(10).default(2),
  maxPages: z.number().int().min(1).max(10_000).default(50),
  artefacts: z.array(artefactFormatSchema).min(1).default([...DEFAULT_ARTEFACT_FORMATS]),
  networkPolicy: networkPolicySchema.default({ mode: 'none' }),
  timeout: z.number().int().positive().max(120_000).default(30_000),
  waitFor: z.enum(['load', 'domcontentloaded', 'networkidle']).default('domcontentloaded'),
  locale: optionalTrimmedString(z.string().min(2).max(10)),
  timezone: optionalTrimmedString(z.string().min(1)),
  headers: z.record(z.string()).optional(),
  includePattern: z.string().optional(),
  excludePattern: z.string().optional(),
  dsl: z.string().optional(),
});
export type CreateCrawlDto = z.infer<typeof createCrawlDto>;

export const crawlOrchestratorPayloadSchema = z.object({
  crawlId: z.string().min(1),
  url: httpUrlString,
  maxDepth: z.number().int().min(0),
  maxPages: z.number().int().min(1),
  artefacts: z.array(artefactFormatSchema).min(1),
  networkPolicy: networkPolicySchema,
  timeout: z.number().int().positive(),
  waitFor: z.enum(['load', 'domcontentloaded', 'networkidle']),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  headers: z.record(z.string()).optional(),
  includePattern: z.string().optional(),
  excludePattern: z.string().optional(),
  dslYaml: z.string().optional(),
});
export type CrawlOrchestratorPayload = z.infer<typeof crawlOrchestratorPayloadSchema>;

export const crawlPagePayloadSchema = z.object({
  crawlId: z.string().min(1),
  pageId: z.string().min(1),
  url: httpUrlString,
  depth: z.number().int().min(0),
  artefacts: z.array(artefactFormatSchema).min(1),
  networkPolicy: networkPolicySchema,
  timeout: z.number().int().positive(),
  waitFor: z.enum(['load', 'domcontentloaded', 'networkidle']),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  headers: z.record(z.string()).optional(),
  dslYaml: z.string().optional(),
  maxDepth: z.number().int().min(0),
  maxPages: z.number().int().min(1),
  includePattern: z.string().optional(),
  excludePattern: z.string().optional(),
});
export type CrawlPagePayload = z.infer<typeof crawlPagePayloadSchema>;

export const crawlPageResultSchema = z.object({
  outcome: runOutcomeSchema,
  artefacts: artefactResultSchema,
  env: runEnvSchema.optional(),
  durationMs: z.number().nonnegative(),
  httpStatus: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  finalUrl: httpUrlString.optional(),
  discoveredUrls: z.array(z.string()).default([]),
});
export type CrawlPageResult = z.infer<typeof crawlPageResultSchema>;

export const crawlResponseSchema = z.object({
  id: z.string(),
  status: crawlStatusSchema,
  url: httpUrlString,
  maxDepth: z.number().int().nonnegative(),
  maxPages: z.number().int().positive(),
  artefacts: z.array(artefactFormatSchema).min(1),
  networkPolicy: networkPolicySchema,
  timeout: z.number().int().positive(),
  waitFor: z.enum(['load', 'domcontentloaded', 'networkidle']),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  headers: z.record(z.string()).optional(),
  includePattern: z.string().optional(),
  excludePattern: z.string().optional(),
  dsl: z.string().optional(),
  totalPages: z.number().int().nonnegative(),
  completedPages: z.number().int().nonnegative(),
  failedPages: z.number().int().nonnegative(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});
export type CrawlResponse = z.infer<typeof crawlResponseSchema>;

export const crawlPageResponseSchema = z.object({
  id: z.string(),
  crawlId: z.string(),
  url: httpUrlString,
  depth: z.number().int().nonnegative(),
  status: crawlPageStatusSchema,
  result: crawlPageResultSchema.optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});
export type CrawlPageResponse = z.infer<typeof crawlPageResponseSchema>;

export const crawlPageListItemSchema = z.object({
  id: z.string(),
  crawlId: z.string(),
  url: httpUrlString,
  depth: z.number().int().nonnegative(),
  status: crawlPageStatusSchema,
  durationMs: z.number().nonnegative().optional(),
  discoveredUrlCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});
export type CrawlPageListItem = z.infer<typeof crawlPageListItemSchema>;

export const crawlPageListResponseSchema = z.object({
  data: z.array(crawlPageListItemSchema),
  total: z.number().int().nonnegative(),
});
export type CrawlPageListResponse = z.infer<typeof crawlPageListResponseSchema>;
