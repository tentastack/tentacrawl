import { z } from 'zod';

export const staticProxyConfigSchema = z.object({
  server: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),
});
export type StaticProxyConfig = z.infer<typeof staticProxyConfigSchema>;

export const networkPolicySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({ mode: z.literal('static'), proxy: staticProxyConfigSchema }),
  z.object({ mode: z.literal('managed'), poolId: z.string().min(1) }),
]);
export type NetworkPolicy = z.infer<typeof networkPolicySchema>;
