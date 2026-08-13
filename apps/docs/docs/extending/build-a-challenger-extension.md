---
title: Build a Challenger Extension
sidebar_position: 2
description: A full walkthrough building a captcha-solving extension, from package skeleton to enabling it.
---

# Build a Challenger Extension

This walks through building a captcha-solving extension end to end. The same shape applies to a fingerprint rotator, a login flow, or anything else that adapts scraping behavior.

## 1. Package skeleton

A challenger is a regular Tentacrawl module — see [Module System](/architecture/module-system) for the full layout rules. The minimum for an extension-only module:

```text
captcha/src/
  index.ts                    # metadata: ModuleInfo + exports
  captcha.module.ts           # forApi() / forWorker()
  data/schemas.ts
  worker/
    captcha.challenger.ts     # the ChallengerExtension
    captcha-solver.service.ts # vendor API client
    captcha.worker-module.ts
```

## 2. Config schema

```ts
export const captchaExtensionConfigSchema = z.object({
  provider: z.enum(['2captcha', 'capsolver']).default('2captcha'),
  apiKey: z.string().default(''),
  maxSolvesPerRun: z.number().int().min(1).default(3),
});
```

Never return a stored secret from your API. Expose a boolean presence flag (`hasApiKey`) and accept writes under a leave-blank-to-keep convention — the proxy module's password handling is the reference for this pattern.

## 3. The extension

```ts
@Injectable()
export class CaptchaChallengerExtension implements ChallengerExtension, OnModuleInit {
  readonly moduleId = 'captcha';
  readonly extensionId = 'solver';
  readonly version = '0.1.0';
  readonly priority = 50; // after proxy (10)
  readonly capabilities: ChallengerCapability[] = ['navigation', 'dsl-action', 'signal-analysis'];
  readonly configSchema = captchaExtensionConfigSchema;

  constructor(
    private readonly registry: ChallengerRegistry,
    private readonly solver: CaptchaSolverService,
  ) {}

  onModuleInit(): void {
    this.registry.registerExtension(this);
  }

  register(r: ChallengerRegistrar): void {
    r.afterNavigation(async (ctx) => this.handle(ctx), {
      mode: 'mutating',
      priority: 50,
      timeoutMs: 120_000,
      errorPolicy: 'disable-extension-for-run', // a vendor outage degrades, doesn't fail, the run
    });
  }

  private async handle(ctx: ChallengerRuntimeContext): Promise<boolean> {
    const page = asPage(ctx);
    if (!page) return false;

    const cfg = captchaExtensionConfigSchema.parse(ctx.config ?? {});
    const used = (ctx.state.get('solves') as number) ?? 0;
    if (used >= cfg.maxSolvesPerRun) return false;

    const detected = await detectCaptcha(page);
    if (!detected) return false;

    await ctx.helpers.emitSignal({
      signalType: 'page.captcha-suspected', // a built-in signal type
      severity: 'warn',
      annotations: { kind: detected.kind, url: page.url() },
    });

    const token = await this.solver.solve(detected, cfg);
    await injectToken(page, detected, token);
    ctx.state.set('solves', used + 1);

    await ctx.helpers.requestNavigationOverride({ action: 'retry', reason: 'captcha solved' });
    return true;
  }
}
```

Two choices worth noting: `errorPolicy: 'disable-extension-for-run'` is right for a paid third-party dependency — a vendor outage degrades the run rather than failing it. `timeoutMs: 120_000` because solving is genuinely slow; the default would let it hang.

## 4. Register it in the worker module

```ts
@Module({
  providers: [CaptchaSolverService, CaptchaChallengerExtension],
})
export class CaptchaWorkerModule {}
```

## 5. Enable it

Add the module to `modules.config.ts` and regenerate:

```ts
{ id: 'captcha', package: '@tentacrawl/captcha' },
```

```bash
pnpm generate
```

The extension appears at **Extensions** in the admin UI with an enable/disable toggle that takes effect on the next run — no restart needed.

## Next steps

- [Intercepting Requests and Responses](/extending/intercepting-requests-and-responses) if you need to inspect or rewrite traffic before the page sees it.
- [Add a Custom DSL Action](/extending/add-a-dsl-action) to make `solveCaptcha` callable as a YAML step instead of (or alongside) the automatic `afterNavigation` hook above.
