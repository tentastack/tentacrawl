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
  z.object({
    mode: z.literal('managed'),
    // fully-qualified challenger extension key, e.g. 'proxy/manual'
    extension: z.string().min(1),
    // specific selection within the extension; omitted = extension decides
    serverId: z.string().min(1).optional(),
  }),
]);
export type NetworkPolicy = z.infer<typeof networkPolicySchema>;
