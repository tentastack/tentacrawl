import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CAPTCHAAI_BASE_URL, CaptchaAIClient } from './captchaai.client';

// The API key is a secret and is never part of the per-extension config stored
// by the challenger host; it only ever comes from the environment.
const captchaaiConfigSchema = z.object({
  CAPTCHAAI_API_KEY: z.string().min(1).optional(),
  CAPTCHAAI_BASE_URL: z.string().url().default(CAPTCHAAI_BASE_URL),
  CAPTCHAAI_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  CAPTCHAAI_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
});

export type CaptchaaiConfig = z.infer<typeof captchaaiConfigSchema>;

export function loadCaptchaaiConfig(configService?: ConfigService): CaptchaaiConfig {
  return captchaaiConfigSchema.parse({
    CAPTCHAAI_API_KEY: configService?.get('CAPTCHAAI_API_KEY'),
    CAPTCHAAI_BASE_URL: configService?.get('CAPTCHAAI_BASE_URL'),
    CAPTCHAAI_POLL_INTERVAL_MS: configService?.get('CAPTCHAAI_POLL_INTERVAL_MS'),
    CAPTCHAAI_TIMEOUT_MS: configService?.get('CAPTCHAAI_TIMEOUT_MS'),
  });
}

// Returns undefined when no API key is configured so the module stays inert
// instead of failing worker or API startup.
export function createCaptchaAIClient(config: CaptchaaiConfig): CaptchaAIClient | undefined {
  if (!config.CAPTCHAAI_API_KEY) return undefined;
  return new CaptchaAIClient({
    apiKey: config.CAPTCHAAI_API_KEY,
    baseUrl: config.CAPTCHAAI_BASE_URL,
    pollIntervalMs: config.CAPTCHAAI_POLL_INTERVAL_MS,
    timeoutMs: config.CAPTCHAAI_TIMEOUT_MS,
  });
}
