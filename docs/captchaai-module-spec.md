# CaptchaAI Module - Specification

Status: Proposed
Owner: Community contribution
Audience: Core maintainers and challenger authors
Scope: `packages/captchaai` (new), `modules.config.ts`

## 1. Purpose

`captchaai` is a challenger extension module that adds captcha handling to a run:
it reports the captcha families found on a page as signals, and solves the ones
CaptchaAI supports through the vendor's HTTP API.

It is written against the contract in `docs/challenger-framework-spec.md` and
mirrors `packages/proxy` (`docs/proxy-module-spec.md`) as the reference module.
It is strictly additive: no core, browser, DSL, or existing module file changes,
apart from the `modules.config.ts` entry and the registries `pnpm generate`
derives from it.

## 2. Scope of support

CaptchaAI solves:

| Family                | Submit parameters                                              |
| --------------------- | -------------------------------------------------------------- |
| reCAPTCHA v2          | `method=userrecaptcha`, `googlekey`, `pageurl` (+ `invisible=1`) |
| reCAPTCHA v3          | `method=userrecaptcha`, `version=v3`, `action`, `min_score`      |
| reCAPTCHA Enterprise  | as above plus `enterprise=1`                                     |
| Cloudflare Turnstile  | `method=turnstile`, `sitekey`, `pageurl`                         |
| Image (text) captcha  | `method=base64`, `body`                                          |

CaptchaAI does **not** solve hCaptcha, FunCaptcha/Arkose, GeeTest or DataDome.
Those families are deliberately absent from every type union in the module. When
one is detected the extension emits a `captchaai.unsupported-challenge` signal
and, for a `solveCaptcha` step, fails the step with an explicit reason instead of
sending a request that would never succeed.

## 3. Extension

`CaptchaAIChallengerExtension` registers as `captchaai/solver`.

- Identity: `moduleId: 'captchaai'`, `extensionId: 'solver'`, `priority: 60`.
- Capabilities: `dsl-action` (the `solveCaptcha` step), `signal-analysis`
  (detection signals), `user-behavior` (writes the solved token into the page).
  If `CHALLENGER_ALLOWED_CAPABILITIES` is set it must include all three.
- `configSchema: captchaaiExtensionConfigSchema`, injected as `ctx.config`.
- Handlers:
  - `afterNavigation` (mutating, priority 60, `errorPolicy: 'warn-and-continue'`,
    `timeoutMs` derived from `CAPTCHAAI_TIMEOUT_MS`): detects challenges, emits
    `page.captcha-suspected` and `captchaai.unsupported-challenge`, and - only
    when `autoSolve` is enabled - solves and injects the token. The handler is
    mutating because it writes into the live page and must not run concurrently
    with other page work.
  - `registerAction({ action: 'solveCaptcha', ... })`: the executable DSL step.

Signals: `page.captcha-suspected` (built in), plus `captchaai.solved`,
`captchaai.solve-failed`, `captchaai.unsupported-challenge`,
`captchaai.not-configured`. Signals carry the family, the (public) sitekey and
the url - never the API key and never the solved token.

## 4. Detection

`detectCaptchas(html)` is a pure function over the rendered HTML, so it is unit
testable without a browser. It reads widget markers (`g-recaptcha`,
`cf-turnstile` and their `data-sitekey`), script markers
(`recaptcha/api.js?render=`, `recaptcha/enterprise.js?render=`, the Turnstile
api.js) and the reCAPTCHA anchor iframe. It never guesses a sitekey it did not
read from the page. Unsupported families are matched by their own markers and
reported separately.

## 5. DSL action

```yaml
name: login
steps:
  - action: goto
    value: https://example.com/login
  - action: solveCaptcha
    type: auto          # or recaptcha-v2 | recaptcha-v3 | recaptcha-enterprise | turnstile | image
    outputKey: captchaToken
  - action: click
    selector: button[type=submit]
```

Fields: `type` (default `auto`), `sitekey` (read from the page when omitted),
`pageurl` (current url when omitted), `selector` (`type: image` only, the element
to screenshot), `invisible`, `recaptchaAction`, `minScore`, `inject`,
`outputKey`, `timeoutMs`. The step returns the token as its output and, unless
`inject: false`, writes it into `g-recaptcha-response` / `cf-turnstile-response`.
It never submits a form; a following `click` step does that.

Quote `sitekey` in YAML: an all-hex Turnstile key such as `0x4AAA` would
otherwise be read as a number by the YAML parser and rejected by the schema.

## 6. Configuration

Secret, environment only (never stored in the challenger config, never returned
by the API):

```dotenv
CAPTCHAAI_API_KEY=...
CAPTCHAAI_BASE_URL=https://ocr.captchaai.com
CAPTCHAAI_POLL_INTERVAL_MS=5000
CAPTCHAAI_TIMEOUT_MS=120000
```

Without `CAPTCHAAI_API_KEY` the module stays inert: it still detects and reports
challenges, and every solve path fails with a clear reason instead of blocking
worker startup.

Per-extension config (`GET`/`PUT /challengers/captchaai%2Fsolver/config`):
`detectOnNavigation` (default true), `autoSolve` (default false), `injectToken`
(default true), `recaptchaV3Action` (default `verify`), `recaptchaV3MinScore`
(default 0.3).

## 7. API

`CaptchaAIController` (`/captchaai`):

- `GET /captchaai/status` - `{ configured, baseUrl }`; reports whether a key is
  present, never the key itself.
- `GET /captchaai/balance` - `{ balance }`, or 503 when no key is configured.

## 8. Testing

- `captchaai-client.spec`: exact submit parameters per family, the
  `CAPCHA_NOT_READY` poll loop, rejected submissions, solve failures, timeout,
  balance, and malformed payloads (fetch is injected, no network access).
- `captcha-detector.spec`: one fixture per supported family plus the unsupported
  families, including the case where an hCaptcha widget carries a `data-sitekey`.
- `captchaai.challenger.spec`: registration and capabilities, detect-only vs
  auto-solve, unsupported families never reaching the solver, config fallbacks,
  and the not-configured paths.
- `schemas.spec`: config defaults and step validation.

## 9. Verification

`pnpm generate` after the `modules.config.ts` change; then `pnpm -r run build`,
`pnpm -r run lint` and `pnpm -r run test`.
