import { ConfigService } from '@nestjs/config';
import {
  CRAWL_ORCHESTRATOR_QUEUE,
  CRAWL_PAGE_QUEUE,
  SCRAPE_QUEUE,
} from '@tentacrawl/core';
import { z } from 'zod';

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

const adminConfigSchema = z.object({
  ADMIN_WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  ADMIN_WORKER_HEALTHY_THRESHOLD_MS: z.coerce.number().int().positive().default(45_000),
  ADMIN_WORKER_STALE_THRESHOLD_MS: z.coerce.number().int().positive().default(120_000),
  ADMIN_DASHBOARD_DEFAULT_LIST_LIMIT: z.coerce.number().int().positive().default(12),
  ADMIN_WORKER_SUPPORTED_QUEUES: z.string()
    .default(`${SCRAPE_QUEUE},${CRAWL_ORCHESTRATOR_QUEUE},${CRAWL_PAGE_QUEUE}`)
    .transform(parseList),
  ADMIN_WORKER_SUPPORTED_MODULES: z.string().default('scraper,crawler').transform(parseList),
}).superRefine((value, ctx) => {
  if (value.ADMIN_WORKER_HEALTHY_THRESHOLD_MS > value.ADMIN_WORKER_STALE_THRESHOLD_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ADMIN_WORKER_HEALTHY_THRESHOLD_MS'],
      message: 'Healthy threshold must be less than or equal to stale threshold.',
    });
  }
});

export type AdminConfig = z.infer<typeof adminConfigSchema>;

export function loadAdminConfig(configService: ConfigService): AdminConfig {
  return adminConfigSchema.parse({
    ADMIN_WORKER_HEARTBEAT_INTERVAL_MS: configService.get('ADMIN_WORKER_HEARTBEAT_INTERVAL_MS'),
    ADMIN_WORKER_HEALTHY_THRESHOLD_MS: configService.get('ADMIN_WORKER_HEALTHY_THRESHOLD_MS'),
    ADMIN_WORKER_STALE_THRESHOLD_MS: configService.get('ADMIN_WORKER_STALE_THRESHOLD_MS'),
    ADMIN_DASHBOARD_DEFAULT_LIST_LIMIT: configService.get('ADMIN_DASHBOARD_DEFAULT_LIST_LIMIT'),
    ADMIN_WORKER_SUPPORTED_QUEUES: configService.get('ADMIN_WORKER_SUPPORTED_QUEUES'),
    ADMIN_WORKER_SUPPORTED_MODULES: configService.get('ADMIN_WORKER_SUPPORTED_MODULES'),
  });
}