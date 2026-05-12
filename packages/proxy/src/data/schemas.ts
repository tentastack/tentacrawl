import { z } from 'zod';

export const PROXY_LEASE_STATUS = ['ACTIVE', 'RELEASED', 'FAILED'] as const;
export const proxyLeaseStatusSchema = z.enum(PROXY_LEASE_STATUS);
export type ProxyLeaseStatus = z.infer<typeof proxyLeaseStatusSchema>;

export const proxyPoolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  providerConfig: z.record(z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ProxyPool = z.infer<typeof proxyPoolSchema>;

export const createProxyPoolDto = proxyPoolSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateProxyPoolDto = z.infer<typeof createProxyPoolDto>;

export const updateProxyPoolDto = createProxyPoolDto.partial();
export type UpdateProxyPoolDto = z.infer<typeof updateProxyPoolDto>;

export const proxyLeaseSchema = z.object({
  id: z.string().min(1),
  poolId: z.string().min(1),
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  assignedAt: z.coerce.date(),
  releasedAt: z.coerce.date().optional(),
  status: proxyLeaseStatusSchema.default('ACTIVE'),
});

export type ProxyLease = z.infer<typeof proxyLeaseSchema>;
