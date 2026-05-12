# Contributing

## Setup

Use the same baseline as the main README:

```bash
pnpm install
pnpm exec playwright install chromium
pnpm generate
```

## Local Validation

Run the narrowest useful checks for your change before opening a pull request.

Common checks:

```bash
pnpm lint
pnpm test
pnpm build
```

For app-local or package-local changes, prefer targeted commands first.

## Working Rules

- Keep changes focused and minimal.
- Do not hand-edit generated registries under `apps/*/src/generated/` or `apps/web/src/generated/`.
- Run `pnpm generate` after changing `modules.config.ts` or module metadata.
- Validate runtime-facing inputs with shared Zod schemas where appropriate.
- Prefer extending existing modules and shared packages over introducing parallel patterns.

## Pull Requests

- Describe the behavior change clearly.
- Call out any generated files included in the diff.
- Mention the validation commands you ran.
- Include screenshots for UI changes when they materially affect the admin surface.

## Local Files

Do not commit local-only files such as `.env.local`, logs, screenshots from ad hoc debugging, or OS/editor metadata.