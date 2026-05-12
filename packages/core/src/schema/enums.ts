import { z } from 'zod';

export const PROXY_MODE = ['none', 'static', 'managed'] as const;
export const proxyModeSchema = z.enum(PROXY_MODE);
export type ProxyMode = z.infer<typeof proxyModeSchema>;

export const TASK_STATUS = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export const taskStatusSchema = z.enum(TASK_STATUS);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const CRAWL_STATUS = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export const crawlStatusSchema = z.enum(CRAWL_STATUS);
export type CrawlStatus = z.infer<typeof crawlStatusSchema>;

export const CRAWL_PAGE_STATUS = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'] as const;
export const crawlPageStatusSchema = z.enum(CRAWL_PAGE_STATUS);
export type CrawlPageStatus = z.infer<typeof crawlPageStatusSchema>;

// runner-level outcome (used by browser package)
export const RUN_OUTCOME = ['OK', 'ERROR', 'PRECONDITION_FAILED', 'BLOCKED'] as const;
export const runOutcomeSchema = z.enum(RUN_OUTCOME);
export type RunOutcome = z.infer<typeof runOutcomeSchema>;
