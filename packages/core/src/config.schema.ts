import { z } from 'zod';

export const baseConfigSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export const mongoConfigSchema = z.object({
  MONGO_URI: z.string().url().startsWith('mongodb'),
  MONGO_DB_NAME: z.string().min(1).default('tentacrawl'),
});

export const redisConfigSchema = z.object({
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
});

export const corsConfigSchema = z.object({
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3001,http://127.0.0.1:3001'),
});

export const apiConfigSchema = baseConfigSchema
  .merge(mongoConfigSchema)
  .merge(redisConfigSchema)
  .merge(corsConfigSchema);

export const workerConfigSchema = baseConfigSchema
  .merge(mongoConfigSchema)
  .merge(redisConfigSchema);

export type BaseConfig = z.infer<typeof baseConfigSchema>;
export type MongoConfig = z.infer<typeof mongoConfigSchema>;
export type RedisConfig = z.infer<typeof redisConfigSchema>;
export type CorsConfig = z.infer<typeof corsConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type WorkerConfig = z.infer<typeof workerConfigSchema>;
