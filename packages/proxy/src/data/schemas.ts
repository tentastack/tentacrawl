import { z } from 'zod';
import { runOutcomeSchema } from '@tentacrawl/core/schema';

// Matches what Playwright's `proxy.server` actually accepts: HTTP/HTTPS/SOCKS5
// with an optional scheme. "gw1.example:8080" (no scheme) is a valid HTTP proxy
// per Playwright's docs, and zod's built-in .url() rejects bare host:port values
// like "127.0.0.1:8080" while accidentally accepting others for the wrong reason
// (WHATWG URL parsing treats the host as a URL "scheme").
const PROXY_ENDPOINT_PATTERN =
  /^(?:(?:https?|socks5):\/\/)?[a-zA-Z0-9.-]+(?::\d{1,5})?$/;
const PROXY_ENDPOINT_MESSAGE =
  'Use host:port (e.g. gw1.example:8080) or scheme://host:port (e.g. http://gw1.example:8080, socks5://gw1.example:1080)';

export const proxyEndpointUrlSchema = z
  .string()
  .trim()
  .min(1, 'Endpoint is required')
  .regex(PROXY_ENDPOINT_PATTERN, PROXY_ENDPOINT_MESSAGE);

export const proxyEndpointSchema = z.object({
  id: z.string().min(1),
  url: proxyEndpointUrlSchema,
  timesUsed: z.number().int().nonnegative().default(0),
  timesSucceeded: z.number().int().nonnegative().default(0),
  timesFailed: z.number().int().nonnegative().default(0),
  lastUsedAt: z.coerce.date().optional(),
  lastFailedAt: z.coerce.date().optional(),
  lastError: z.string().optional(),
});
export type ProxyEndpoint = z.infer<typeof proxyEndpointSchema>;

// ISO 3166-1 alpha-2 country code, e.g. 'US', 'PL'
export const proxyLocationSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Location must be an ISO 3166-1 alpha-2 country code');

export const proxyServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  location: proxyLocationSchema.optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  notes: z.string().optional(),
  endpoints: z.array(proxyEndpointSchema).min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ProxyServer = z.infer<typeof proxyServerSchema>;

// password never returned; hasPassword only reports whether one is set
export interface ProxyServerResponse {
  id: string;
  name: string;
  enabled: boolean;
  location?: string;
  username?: string;
  hasPassword: boolean;
  notes?: string;
  endpoints: ProxyEndpoint[];
  createdAt: Date;
  updatedAt: Date;
}

// id present for edits (preserves stats), omitted for new rows
export const proxyEndpointInputSchema = z.object({
  id: z.string().min(1).optional(),
  url: proxyEndpointUrlSchema,
});
export type ProxyEndpointInput = z.infer<typeof proxyEndpointInputSchema>;

export const createProxyServerDto = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean().default(true),
  location: proxyLocationSchema.optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  notes: z.string().optional(),
  endpoints: z.array(proxyEndpointInputSchema).min(1, 'At least one endpoint is required'),
});
export type CreateProxyServerDto = z.infer<typeof createProxyServerDto>;

export const updateProxyServerDto = createProxyServerDto;
export type UpdateProxyServerDto = z.infer<typeof updateProxyServerDto>;

export const PROXY_USAGE_FILTERS = ['used', 'unused', 'failing'] as const;

export const PROXY_SERVER_SORTS = [
  'name',
  'enabled',
  'location',
  'createdAt',
  'updatedAt',
] as const;

export const listProxyServersQuerySchema = z.object({
  name: z.string().optional(),
  endpoint: z.string().optional(),
  enabled: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  location: proxyLocationSchema.optional(),
  usage: z.enum(PROXY_USAGE_FILTERS).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  sort: z.enum(PROXY_SERVER_SORTS).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type ListProxyServersQuery = z.infer<typeof listProxyServersQuerySchema>;

export const proxyUsageSchema = z.object({
  id: z.string().min(1),
  serverId: z.string().min(1),
  endpointId: z.string().min(1),
  endpointUrl: z.string().min(1),
  taskId: z.string().min(1),
  taskType: z.string().min(1),
  // the run's top-level id; for crawl-page tasks this is the parent crawlId
  // (taskId is the individual page id), letting the UI link to the right detail page
  correlationId: z.string().optional(),
  outcome: runOutcomeSchema.optional(),
  error: z.string().optional(),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().optional(),
  durationMs: z.number().nonnegative().optional(),
});
export type ProxyUsage = z.infer<typeof proxyUsageSchema>;

export const testProxyEndpointDto = z.object({
  url: proxyEndpointUrlSchema,
  username: z.string().optional(),
  password: z.string().optional(),
  // present when testing an endpoint on an already-saved server; lets the
  // backend fall back to the stored password (never sent to the client)
  serverId: z.string().min(1).optional(),
});
export type TestProxyEndpointDto = z.infer<typeof testProxyEndpointDto>;

export interface ProxyValidationDetails {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  org?: string;
  latencyMs: number;
}

export interface ProxyValidationResult {
  ok: boolean;
  error?: string;
  details?: ProxyValidationDetails;
}

export const PROXY_ROTATIONS = ['round-robin', 'random'] as const;

// configSchema for the proxy/manual extension; also drives its settings panel
export const proxyExtensionConfigSchema = z.object({
  rotation: z.enum(PROXY_ROTATIONS).default('round-robin'),
  countBlockedAsFailure: z.boolean().default(true),
});
export type ProxyExtensionConfig = z.infer<typeof proxyExtensionConfigSchema>;
