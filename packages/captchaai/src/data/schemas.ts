import { z } from 'zod';

// Challenge families CaptchaAI can solve. hCaptcha, FunCaptcha/Arkose, GeeTest
// and DataDome are intentionally absent: the service does not solve them.
export const CAPTCHAAI_SOLVABLE_KINDS = [
  'recaptcha-v2',
  'recaptcha-v3',
  'recaptcha-enterprise',
  'turnstile',
  'image',
] as const;
export type CaptchaaiSolvableKind = (typeof CAPTCHAAI_SOLVABLE_KINDS)[number];

export const CAPTCHAAI_UNSUPPORTED_KINDS = [
  'hcaptcha',
  'funcaptcha',
  'geetest',
  'datadome',
] as const;
export type CaptchaaiUnsupportedKind = (typeof CAPTCHAAI_UNSUPPORTED_KINDS)[number];

export const SOLVE_CAPTCHA_ACTION = 'solveCaptcha';

export const solveCaptchaStepSchema = z.object({
  action: z.literal(SOLVE_CAPTCHA_ACTION),
  type: z.enum(['auto', ...CAPTCHAAI_SOLVABLE_KINDS]).default('auto'),
  // omitted for type 'auto': the sitekey is then read from the live page
  sitekey: z.string().min(1).optional(),
  // omitted: the current page url is used
  pageurl: z.string().url().optional(),
  // type 'image' only: element to screenshot and send as base64
  selector: z.string().min(1).optional(),
  invisible: z.boolean().optional(),
  recaptchaAction: z.string().min(1).optional(),
  minScore: z.number().min(0).max(1).optional(),
  // write the token into the page's captcha response field (default: config)
  inject: z.boolean().optional(),
  outputKey: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().optional(),
});
export type SolveCaptchaStep = z.infer<typeof solveCaptchaStepSchema>;

// configSchema for the captchaai/solver extension; stored by the challenger
// host and injected as ctx.config. The API key is never stored here.
export const captchaaiExtensionConfigSchema = z.object({
  detectOnNavigation: z.boolean().default(true),
  autoSolve: z.boolean().default(false),
  injectToken: z.boolean().default(true),
  recaptchaV3Action: z.string().min(1).default('verify'),
  recaptchaV3MinScore: z.number().min(0).max(1).default(0.3),
});
export type CaptchaaiExtensionConfig = z.infer<typeof captchaaiExtensionConfigSchema>;

export interface CaptchaaiStatus {
  configured: boolean;
  baseUrl: string;
}

export type CaptchaSolveRequest =
  | {
      kind: 'recaptcha-v2' | 'recaptcha-enterprise';
      sitekey: string;
      pageurl: string;
      invisible?: boolean;
    }
  | {
      kind: 'recaptcha-v3';
      sitekey: string;
      pageurl: string;
      action?: string;
      minScore?: number;
      enterprise?: boolean;
    }
  | { kind: 'turnstile'; sitekey: string; pageurl: string; action?: string }
  | { kind: 'image'; body: string };
