import { z } from 'zod';

export const brightdataPoolConfigSchema = z.object({
  zone: z.string().min(1),
  customer: z.string().min(1),
  password: z.string().min(1),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  country: z.string().optional(),
});

export type BrightDataPoolConfig = z.infer<typeof brightdataPoolConfigSchema>;
