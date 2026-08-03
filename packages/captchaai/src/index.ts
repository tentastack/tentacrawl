import type { ModuleInfo } from '@tentacrawl/core';

export const metadata: ModuleInfo = {
  name: 'captchaai',
  title: 'CaptchaAI',
  version: '0.1.0',
  description:
    'CaptchaAI challenger extension: detects and solves reCAPTCHA v2/v3/Enterprise, Cloudflare Turnstile, and image captchas',
  requires: ['challenger'],
};

export { CaptchaaiModule } from './captchaai.module';
export { CaptchaAIChallengerExtension } from './worker/captchaai.challenger';
export { CaptchaAISolverService } from './worker/captchaai-solver.service';
export { detectCaptchas } from './worker/captcha-detector';
export type {
  CaptchaDetection,
  DetectedChallenge,
  DetectedChallengeKind,
} from './worker/captcha-detector';
export {
  CAPTCHAAI_BASE_URL,
  CaptchaAIClient,
  CaptchaAIError,
} from './captchaai.client';
export type {
  CaptchaAIClientOptions,
  CaptchaAIFetch,
  ImageRequest,
  RecaptchaV2Request,
  RecaptchaV3Request,
  TurnstileRequest,
} from './captchaai.client';
export { loadCaptchaaiConfig, createCaptchaAIClient } from './config';
export type { CaptchaaiConfig } from './config';
export {
  CAPTCHAAI_SOLVABLE_KINDS,
  CAPTCHAAI_UNSUPPORTED_KINDS,
  SOLVE_CAPTCHA_ACTION,
  captchaaiExtensionConfigSchema,
  solveCaptchaStepSchema,
} from './data/schemas';
export type {
  CaptchaSolveRequest,
  CaptchaaiExtensionConfig,
  CaptchaaiSolvableKind,
  CaptchaaiStatus,
  CaptchaaiUnsupportedKind,
  SolveCaptchaStep,
} from './data/schemas';
