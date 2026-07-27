# AGENTS.md

This file defines the working conventions for AI agents and other automated contributors in this repository.

## 1. Operating Principles

- Favor correctness, clarity, and testability over cleverness.
- Keep changes minimal and scoped to the request.
- Prefer explicit schemas, contracts, and metadata over implicit behavior.
- Avoid breaking public APIs unless the change is intentional and documented.
- Treat generated files as derived output, not hand-edited source.

## 2. Current Monorepo Shape

### Applications

- `apps/api`: NestJS API for HTTP endpoints, admin operations, health, and metrics
- `apps/worker`: NestJS worker for BullMQ consumers and Playwright execution
- `apps/web`: Next.js 15 admin UI using the App Router

### Foundational packages

- `packages/browser`: hardened Playwright context, artefact collection, link discovery
- `packages/cli`: code generation for module registries
- `packages/core`: shared schemas, config validation, module metadata, extension registry
- `packages/dsl`: YAML DSL validation and compilation
- `packages/ui`: shared frontend component library

### Current enabled modules

Enabled in `modules.config.ts`:

- `admin`: dashboard, worker presence, operational activity tracking
- `challenger`: extension framework host (dispatch, signals, and the extensions admin dashboard)
- `crawler`: multi-page crawling module
- `notification`: lifecycle notifications
- `proxy`: manually defined proxy servers with endpoint rotation and usage tracking; the reference challenger extension
- `scraper`: single-page scraping module

### Generated registries

The workspace commits generated registries. After changing `modules.config.ts` or module metadata, run `pnpm generate`.

- `apps/api/src/generated/modules.ts`
- `apps/worker/src/generated/modules.ts`
- `apps/web/src/generated/navigation.ts`
- `apps/web/src/generated/routes.ts`

Do not hand-edit those generated files unless the task explicitly targets the generator itself.

## 2.1 Change Discipline

- For non-trivial work, write a short plan before editing code.
- Before adding new files or patterns, check whether an existing module or package already provides the needed shape.
- After changing runtime behavior or generated metadata, run the narrowest meaningful verification command and record the outcome.
- Prefer extending existing contracts over introducing parallel patterns that solve the same problem differently.

## 3. Code Style and Naming

- Language: TypeScript 5.x, Node 22 LTS.
- Files: kebab-case.
- Classes: PascalCase.
- Functions and variables: camelCase.
- Constants: UPPER_SNAKE_CASE.
- Packages and NestJS modules use singular names.
- Database collection names may remain plural.
- Avoid non-ASCII characters in code and config.
- Keep files cohesive and focused on one responsibility.
- Keep comments to the minimum required for clarity.
- Use short inline comments only when the code would otherwise be hard to parse.
- Do not add JSDoc blocks, section banners, or comments that restate names.

## 4. Type Safety and Validation

- Validate all inbound runtime data with Zod.
- Share DTOs and schemas through package boundaries when they are used by more than one app.
- Avoid `any`; prefer `unknown` plus schema parsing.
- Use MikroORM repositories or `EntityManager` for persistence.
- Do not build query strings or database filters through unsafe interpolation.

## 5. Configuration

- Use `@nestjs/config` for runtime configuration.
- Validate config at startup.
- Only provide defaults when they are safe and intentional.
- Keep local-only config in `.env.local`; never commit those files.

## 6. Logging and Metrics

- Use structured logging with `pino`.
- Include correlation identifiers for job execution and cross-module events.
- Expose Prometheus metrics at `/metrics` for API and worker.

## 7. Queues and Jobs

- BullMQ is the default queue implementation.
- Keep job payloads small; pass ids, not large blobs.
- Persist meaningful job and task state transitions.
- Prefer deterministic retries and explicit failure states over hidden recovery logic.

## 8. DSL and Browser Runtime

- The DSL is YAML and must stay use-case agnostic.
- Browser execution flows through `packages/browser` and the shared extension registry.
- Runner outputs are stored as generic JSON artefacts rather than hard-coded domain entities.
- Network policy must support direct and proxy-backed execution.

## 9. Module Conventions

Feature modules such as `admin`, `challenger`, `crawler`, `notification`, `proxy`, and `scraper` follow a deterministic structure. Foundational packages such as `browser`, `cli`, `core`, `dsl`, and `ui` are exempt.

### Expected layout

```text
packages/<module>/src/
  index.ts
  <module>.module.ts
  event.ts
  api/
    <module>.controller.ts
    <module>.api-module.ts
  worker/
    <module>.processor.ts
    <module>.service.ts
    <module>.worker-module.ts
  data/
    entities.ts
    schemas.ts
  frontend/
    index.ts
    pages/
    components/
    hooks/
  __tests__/
```

### Rules

- `src/index.ts` must export `metadata: ModuleInfo`.
- Each module must expose `forApi()` and `forWorker()` on its NestJS module.
- Modules self-configure through `ConfigService`; other modules should not reach into their internals.
- Cross-module integration happens through the `ChallengerRegistry`/`ChallengerDispatcher` extension framework (see `packages/challenger`), typed events, and public exports.
- Each module owns its `data/entities.ts` and `data/schemas.ts`.
- Real implementation files live under `src/`.
- If a package needs subpath imports such as `@tentacrawl/<module>/data/schemas`, provide thin root proxy files that re-export from `src/`.
- External consumers must import through public package exports, never another package's `src/` tree.
- Internal imports inside a package should continue to use relative imports.

## 10. Frontend Conventions

### Stack

- Next.js 15
- React 19
- Tailwind CSS v4
- TanStack Query v5
- TanStack Table v8
- lucide-react icons
- sonner-based notifications through `flash()` in `packages/ui`

### Architecture

- Reusable frontend building blocks belong in `packages/ui`.
- `apps/web` contains thin route wrappers, shared providers, shell config, and app-level layout.
- Module-specific frontend code lives in `packages/<module>/src/frontend/`.
- Module packages expose frontend entrypoints via `./frontend` subpath exports.

### File conventions

- Route files in `apps/web/src/app/(admin)/` should stay thin and delegate to module pages.
- Page components follow route-shaped directories under `frontend/pages/`.
- Shared form config belongs in `frontend/components/form-config.ts`.
- Data hooks belong in `frontend/hooks/` and own API interaction.

### Styling rules

- Use Tailwind utility classes only.
- Do not use inline styles.
- Do not import component-local CSS files.
- Use `cn()` from `@tentacrawl/ui` for class merging.
- Keep the UI correct in dark mode first.
- Use theme variables rather than raw hex or rgb values.

### Component rules

- Import primitives from `@tentacrawl/ui`, not Radix directly.
- Use `CrudForm` for create and edit workflows.
- Use `DataTable` for list views.
- Use `DataLoader` for loading and error boundaries around async content.
- Use `flash()` for user feedback.
- Prefer narrow, composable component APIs.

### API integration

- Frontend API base URL comes from `NEXT_PUBLIC_API_URL`.
- API calls must go through `apiCall()` or `apiCallOrThrow()` from `@tentacrawl/ui`.
- Shared validation schemas stay in module `data/schemas.ts` files.
- Client-safe schema imports should come from `@tentacrawl/core/schema`, not the full core barrel.

## 11. Testing

- Prefer unit tests for schemas, parsers, compiler behavior, and isolated services.
- Add integration coverage for queue flow, worker orchestration, and module boundaries.
- Keep tests deterministic with fixtures and mocks.
- Avoid tests that require fragile timing or external network access.
- For non-trivial changes, prefer the smallest useful verification first, then widen to workspace-level checks when multiple apps or packages are involved.

## 12. Documentation

- Keep `README.md` and this file aligned with the real repository structure.
- Document behavior changes when they affect setup, module generation, or runtime flow.
- Keep markdown concise and ASCII-only.

## 13. Security and Compliance

- Never log secrets or credentials.
- Keep sensitive values in environment variables or a secrets manager.
- Respect site terms, rate limits, and configured network policies.
