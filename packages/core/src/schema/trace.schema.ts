import { z } from 'zod';

export const traceStepSchema = z.object({
  index: z.number().int().nonnegative(),
  action: z.string().min(1),
  durationMs: z.number().nonnegative(),
  error: z.string().optional(),
  screenshotPath: z.string().optional(),
});

export const traceSchema = z.object({
  steps: z.array(traceStepSchema),
});

export const runEnvSchema = z.object({
  workerId: z.string().min(1),
  proxyServer: z.string().optional(),
  userAgent: z.string().optional(),
  viewport: z.string().optional(),
});

export type TraceStep = z.infer<typeof traceStepSchema>;
export type Trace = z.infer<typeof traceSchema>;
export type RunEnv = z.infer<typeof runEnvSchema>;
