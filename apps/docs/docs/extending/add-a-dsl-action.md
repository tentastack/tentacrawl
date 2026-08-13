---
title: Add a Custom DSL Action
sidebar_position: 4
description: Register a new executable step so YAML flows can call your extension directly.
---

# Add a Custom DSL Action

The base DSL grammar (`goto`, `click`, `extractText`, and so on — see the [DSL Grammar reference](/reference/dsl-grammar)) is deliberately fixed and use-case agnostic. A Challenger extension can add to it without touching `packages/dsl`, by registering an action.

```ts
r.registerAction({
  action: 'solveCaptcha',
  schema: z.object({
    action: z.literal('solveCaptcha'),
    selector: z.string().optional(),
  }),
  execute: async (ctx) => {
    const solved = await this.handle(ctx);
    return solved ? { output: { solved: true } } : { preconditionFailed: true };
  },
});
```

Once registered, `solveCaptcha` is valid in any YAML flow:

```yaml
steps:
  - action: goto
    value: "https://example.com/login"
  - action: solveCaptcha
    selector: "#captcha-widget"
```

## How it resolves

The action's `schema` is unioned into the compiled step schema, so the DSL compiler accepts it like a base action. At runtime, `step-executor.ts` looks up any action not in its built-in handler table through `session.resolveAction(name)` and calls your `execute(ctx)`, mapping the returned `ChallengerActionResult` onto the step's result.

## Constraints

- `capabilities` must include `dsl-action`, or the registration is dropped.
- The action name must not collide with a base DSL action name or another extension's — the registry rejects both at registration time, not silently.
- `execute` receives a `ChallengerStepContext`, the same handler context shape as `beforeStep`/`afterStep`, so `ctx.state`, `ctx.helpers`, and `asPage(ctx)` all work the same way here.

## Next steps

- [Build a Challenger Extension](/extending/build-a-challenger-extension) for the full extension this action would belong to.
- [DSL Grammar reference](/reference/dsl-grammar) for the base action set this one extends.
