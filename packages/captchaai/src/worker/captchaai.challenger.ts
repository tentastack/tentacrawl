import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { asPage } from '@tentacrawl/challenger';
import { ChallengerRegistry } from '@tentacrawl/core';
import type {
  ChallengerActionResult,
  ChallengerCapability,
  ChallengerExtension,
  ChallengerNavigationContext,
  ChallengerRegistrar,
  ChallengerRuntimeContext,
  ChallengerStepContext,
} from '@tentacrawl/core';
import type { Page } from 'playwright';
import {
  SOLVE_CAPTCHA_ACTION,
  captchaaiExtensionConfigSchema,
  solveCaptchaStepSchema,
  type CaptchaaiExtensionConfig,
  type CaptchaSolveRequest,
  type SolveCaptchaStep,
} from '../data/schemas';
import { detectCaptchas, type DetectedChallenge } from './captcha-detector';
import { CaptchaAISolverService } from './captchaai-solver.service';
import { injectCaptchaToken } from './token-injection';

const SCREENSHOT_TIMEOUT_MS = 10_000;

// CaptchaAI challenger extension. Detection runs on every navigation and is
// reported through signals; solving happens either on an explicit `solveCaptcha`
// DSL step or, when enabled in the extension config, automatically.
@Injectable()
export class CaptchaAIChallengerExtension implements ChallengerExtension, OnModuleInit {
  readonly moduleId = 'captchaai';
  readonly extensionId = 'solver';
  readonly version = '0.1.0';
  readonly priority = 60;
  readonly capabilities: ChallengerCapability[] = [
    'dsl-action',
    'signal-analysis',
    'user-behavior',
  ];
  readonly configSchema = captchaaiExtensionConfigSchema;

  private readonly logger = new Logger(CaptchaAIChallengerExtension.name);

  constructor(
    private readonly registry: ChallengerRegistry,
    private readonly solver: CaptchaAISolverService,
  ) {}

  onModuleInit(): void {
    this.registry.registerExtension(this);
  }

  register(registrar: ChallengerRegistrar): void {
    // mutating: auto-solve writes the token into the live page, so this handler
    // must not run concurrently with other page work
    registrar.afterNavigation((ctx) => this.inspect(ctx), {
      mode: 'mutating',
      priority: 60,
      timeoutMs: this.solver.solveTimeoutMs + SCREENSHOT_TIMEOUT_MS,
      errorPolicy: 'warn-and-continue',
    });

    registrar.registerAction({
      action: SOLVE_CAPTCHA_ACTION,
      schema: solveCaptchaStepSchema,
      execute: (ctx) => this.solveStep(ctx),
    });
  }

  private async inspect(ctx: ChallengerNavigationContext): Promise<void> {
    const config = this.config(ctx);
    if (!config.detectOnNavigation) return;

    const page = asPage(ctx);
    if (!page) return;

    const detection = detectCaptchas(await page.content());
    for (const kind of detection.unsupported) {
      await ctx.helpers.emitSignal({
        signalType: 'captchaai.unsupported-challenge',
        severity: 'warn',
        annotations: { kind, url: ctx.finalUrl ?? ctx.requestedUrl },
      });
    }

    const challenge = detection.supported[0];
    if (!challenge) return;

    await ctx.helpers.emitSignal({
      signalType: 'page.captcha-suspected',
      severity: 'info',
      annotations: {
        kind: challenge.kind,
        sitekey: challenge.sitekey,
        url: ctx.finalUrl ?? ctx.requestedUrl,
      },
    });

    if (!config.autoSolve) return;
    if (!challenge.sitekey) {
      this.logger.warn(`Detected ${challenge.kind} without a sitekey; skipping auto-solve`);
      return;
    }
    if (!this.solver.configured) {
      await ctx.helpers.emitSignal({
        signalType: 'captchaai.not-configured',
        severity: 'warn',
        annotations: { kind: challenge.kind },
      });
      return;
    }

    const pageurl = ctx.finalUrl ?? ctx.requestedUrl ?? page.url();
    try {
      const token = await this.solveChallenge(challenge, challenge.sitekey, pageurl, config);
      if (config.injectToken) await injectCaptchaToken(page, challenge.kind, token);
      await ctx.helpers.emitSignal({
        signalType: 'captchaai.solved',
        severity: 'info',
        annotations: { kind: challenge.kind, injected: config.injectToken },
      });
    } catch (error: unknown) {
      await ctx.helpers.emitSignal({
        signalType: 'captchaai.solve-failed',
        severity: 'warn',
        annotations: { kind: challenge.kind, error: messageOf(error) },
      });
    }
  }

  private async solveStep(ctx: ChallengerStepContext): Promise<ChallengerActionResult> {
    const parsed = solveCaptchaStepSchema.safeParse(ctx.step);
    if (!parsed.success) {
      return {
        error: `Invalid ${SOLVE_CAPTCHA_ACTION} step: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ')}`,
        preconditionFailed: true,
      };
    }

    const step = parsed.data;
    const page = asPage(ctx);
    if (!page) {
      return { error: `${SOLVE_CAPTCHA_ACTION} requires a browser page`, preconditionFailed: true };
    }
    if (!this.solver.configured) {
      return { error: 'CAPTCHAAI_API_KEY is not configured', preconditionFailed: true };
    }

    try {
      return await this.runStep(ctx, step, page);
    } catch (error: unknown) {
      const message = messageOf(error);
      await ctx.helpers.emitSignal({
        signalType: 'captchaai.solve-failed',
        severity: 'warn',
        annotations: { type: step.type, error: message },
      });
      return { error: message };
    }
  }

  private async runStep(
    ctx: ChallengerStepContext,
    step: SolveCaptchaStep,
    page: Page,
  ): Promise<ChallengerActionResult> {
    const config = this.config(ctx);

    if (step.type === 'image') {
      if (!step.selector) {
        return {
          error: `${SOLVE_CAPTCHA_ACTION} type "image" requires a selector`,
          preconditionFailed: true,
        };
      }
      const image = await page.locator(step.selector).screenshot({
        timeout: step.timeoutMs ?? SCREENSHOT_TIMEOUT_MS,
      });
      return { output: await this.solver.solve({ kind: 'image', body: image.toString('base64') }) };
    }

    let challenge: DetectedChallenge;
    if (step.type === 'auto') {
      const detection = detectCaptchas(await page.content());
      const detected = detection.supported[0];
      if (!detected) {
        for (const kind of detection.unsupported) {
          await ctx.helpers.emitSignal({
            signalType: 'captchaai.unsupported-challenge',
            severity: 'warn',
            annotations: { kind },
          });
        }
        return {
          error:
            detection.unsupported.length > 0
              ? `CaptchaAI does not solve ${detection.unsupported.join(', ')}`
              : 'No supported captcha was detected on the page',
          preconditionFailed: true,
        };
      }
      challenge = detected;
    } else {
      challenge = {
        kind: step.type,
        sitekey: step.sitekey,
        invisible: step.invisible,
        scoreBased: step.minScore !== undefined || step.recaptchaAction !== undefined,
      };
    }

    const sitekey = step.sitekey ?? challenge.sitekey;
    if (!sitekey) {
      return {
        error: `Could not determine the ${challenge.kind} sitekey; set it on the step`,
        preconditionFailed: true,
      };
    }

    const pageurl = step.pageurl ?? page.url();
    const token = await this.solveChallenge(challenge, sitekey, pageurl, config, step);
    if (step.inject ?? config.injectToken) {
      await injectCaptchaToken(page, challenge.kind, token);
    }
    return { output: token };
  }

  private solveChallenge(
    challenge: DetectedChallenge,
    sitekey: string,
    pageurl: string,
    config: CaptchaaiExtensionConfig,
    step?: SolveCaptchaStep,
  ): Promise<string> {
    const action = step?.recaptchaAction ?? challenge.action ?? config.recaptchaV3Action;
    const minScore = step?.minScore ?? config.recaptchaV3MinScore;
    const invisible = step?.invisible ?? challenge.invisible;

    let request: CaptchaSolveRequest;
    switch (challenge.kind) {
      case 'recaptcha-v3':
        request = { kind: 'recaptcha-v3', sitekey, pageurl, action, minScore };
        break;
      case 'recaptcha-enterprise':
        request = challenge.scoreBased
          ? { kind: 'recaptcha-v3', sitekey, pageurl, action, minScore, enterprise: true }
          : { kind: 'recaptcha-enterprise', sitekey, pageurl, invisible };
        break;
      case 'turnstile':
        request = { kind: 'turnstile', sitekey, pageurl, action: challenge.action };
        break;
      case 'recaptcha-v2':
        request = { kind: 'recaptcha-v2', sitekey, pageurl, invisible };
        break;
    }
    return this.solver.solve(request);
  }

  // defensive: also covers direct invocations that skip the dispatcher's validation
  private config(ctx: ChallengerRuntimeContext): CaptchaaiExtensionConfig {
    const parsed = captchaaiExtensionConfigSchema.safeParse(ctx.config ?? {});
    return parsed.success ? parsed.data : captchaaiExtensionConfigSchema.parse({});
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
