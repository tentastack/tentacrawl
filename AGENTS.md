# AGENTS.md

Working conventions for AI agents and other automated contributors in this
repository. These rules take precedence over default behavior.

## 1. Operating Principles

- Favor correctness, clarity, and testability over cleverness.
- Keep changes minimal and scoped to the request.
- Prefer explicit schemas, contracts, and metadata over implicit behavior.
- Prefer extending existing modules, packages, and contracts over introducing
  parallel patterns that solve the same problem differently.
- Treat generated files as derived output, not hand-edited source.
- Never mix formatting changes with behavior changes.
- For non-trivial work, write a short plan before editing code.
- Before adding a file or a pattern, check whether an existing module or package
  already provides the needed shape.

### Ask before proceeding

- Database schema or entity changes.
- New runtime or build dependencies.
- Breaking changes to a public package export or a module contract.

### Never

- Commit secrets, credentials, or `.env.local` files.
- Delete, skip, or weaken a failing test to make a build pass.
- Hand-edit generated registries, or any version field.

## 2. Repository Shape

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

### Enabled modules

Enabled in `modules.config.ts`:

- `admin`: dashboard, worker presence, operational activity tracking
- `challenger`: extension framework host (dispatch, signals, and the extensions admin dashboard)
- `crawler`: multi-page crawling module
- `notification`: lifecycle notifications
- `proxy`: manually defined proxy servers with endpoint rotation and usage tracking; the reference challenger extension
- `scraper`: single-page scraping module

### Generated registries

The workspace commits these generated files. Do not hand-edit them unless the
task explicitly targets the generator itself.

- `apps/api/src/generated/modules.ts`
- `apps/worker/src/generated/modules.ts`
- `apps/web/src/generated/navigation.ts`
- `apps/web/src/generated/routes.ts`

## 3. Workflow and Verification

- Use `pnpm` for every workspace command; never `npm` or `yarn`.
- Run `pnpm generate` after changing `modules.config.ts` or module metadata.
- Run the narrowest useful check first, then widen when a change crosses package
  or app boundaries. Record what was run and its outcome.

| Check                | Command         |
| -------------------- | --------------- |
| Lint                 | `pnpm lint`     |
| Tests                | `pnpm test`     |
| Build and type check | `pnpm build`    |
| Generated registries | `pnpm generate` |

`.github/workflows/ci.yml` runs `lint`, `test`, `build`, and `generated` on every
pull request and every push to `main`. The `generated` job re-runs `pnpm generate`
and fails if the committed registries differ, so never leave a metadata change
ungenerated. The aggregate `CI` job is the only required status check.

## 4. Commits, Pull Requests, and Versioning

Commit subjects and pull request titles follow
[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

- Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`,
  `style`, `chore`, `revert`.
- Scope is optional and names the package or app without the `@tentacrawl/`
  prefix, for example `feat(challenger):` or `fix(scraper,crawler):`.
- Subjects are lowercase, imperative, and carry no trailing period.
- Breaking changes take a `!` after the type or scope, or a `BREAKING CHANGE:`
  footer.
- One logical change per commit.

Pull requests are squash merged, so the pull request title becomes the commit
message on `main`. `.github/workflows/pr-title.yml` enforces the format.

### Versioning

Versioning is automated by release-please and is never done by hand.

- The root `package.json` holds the single product version, owned by a release
  pull request. Do not edit it, `CHANGELOG.md`, or
  `.release-please-manifest.json`.
- Packages under `packages/` and `apps/` declare no `version` field. They are
  private, never published, and ship as one product.
- `ModuleInfo` carries no `version` field. Runtime consumers that must report one
  call `readPackageVersion(__dirname)` from `@tentacrawl/core/module-version`,
  which walks up to the nearest `package.json` that declares a version. In this
  repository that resolves to the root product version; an extension extracted
  into its own repository resolves to its own, with no code change.
- `feat` bumps the minor version, `fix` and `perf` bump the patch version, and
  other types do not release on their own.

## 5. Code Style and Naming

- Language: TypeScript 5.x, Node 22 LTS.
- Files: kebab-case.
- Classes: PascalCase.
- Functions and variables: camelCase.
- Constants: UPPER_SNAKE_CASE.
- Packages and NestJS modules use singular names.
- Database collection names may remain plural.
- Avoid non-ASCII characters in code and config.
- Keep files cohesive and focused on one responsibility.

### Comments

Default to no comment. A comment is a cost: it drifts from the code and adds noise to every future read.

- Write one only when a reader who understands TypeScript would still misread the code without it, and the code cannot be made clearer instead. Prefer a better name, a smaller function, or a named constant over a comment.
- Legitimate cases are narrow: a non-obvious external constraint, a deliberate trade-off, or a subtle ordering or failure requirement that the code cannot express.
- Do not add JSDoc blocks, section banners, or trailing explanations of a change.
- Do not restate what the code already says. If a comment paraphrases the next line, the identifiers, the types, or the diff, delete it.
- When editing, leave existing comments alone unless the change makes them wrong.
- Before finishing, re-read every comment added and delete each one that does not meet the bar above.

## 6. Type Safety and Validation

- Validate all inbound runtime data with Zod.
- Share DTOs and schemas through package boundaries when they are used by more than one app.
- Avoid `any`; prefer `unknown` plus schema parsing.
- Use MikroORM repositories or `EntityManager` for persistence.
- Do not build query strings or database filters through unsafe interpolation.

## 7. Configuration

- Use `@nestjs/config` for runtime configuration.
- Validate config at startup.
- Only provide defaults when they are safe and intentional.
- Keep local-only config in `.env.local`; never commit those files.

## 8. Logging and Metrics

- Use structured logging with `pino`.
- Include correlation identifiers for job execution and cross-module events.
- Expose Prometheus metrics at `/metrics` for API and worker.

## 9. Queues and Jobs

- BullMQ is the default queue implementation.
- Keep job payloads small; pass ids, not large blobs.
- Persist meaningful job and task state transitions.
- Prefer deterministic retries and explicit failure states over hidden recovery logic.

## 10. DSL and Browser Runtime

- The DSL is YAML and must stay use-case agnostic.
- Browser execution flows through `packages/browser` and the shared extension registry.
- Runner outputs are stored as generic JSON artefacts rather than hard-coded domain entities.
- Network policy must support direct and proxy-backed execution.

## 11. Module Conventions

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

- `src/index.ts` must export `metadata: ModuleInfo`. `@tentacrawl/cli` parses this
  file statically, so every metadata field must be a literal.
- Each module must expose `forApi()` and `forWorker()` on its NestJS module.
- Modules self-configure through `ConfigService`; other modules should not reach into their internals.
- Cross-module integration happens through the `ChallengerRegistry`/`ChallengerDispatcher` extension framework (see `packages/challenger`), typed events, and public exports.
- Each module owns its `data/entities.ts` and `data/schemas.ts`.
- Real implementation files live under `src/`.
- If a package needs subpath imports such as `@tentacrawl/<module>/data/schemas`, provide thin root proxy files that re-export from `src/`. Register the subpath in both `exports` and `typesVersions`; the workspace uses `moduleResolution: node`, which ignores `exports`.
- External consumers must import through public package exports, never another package's `src/` tree.
- Internal imports inside a package should continue to use relative imports.

## 12. Frontend Conventions

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
- Client-safe schema imports should come from `@tentacrawl/core/schema`, not the full core barrel. Never pull Node built-ins into a module that the web bundle imports.

## 13. Testing

- Write the test before the code.
- For a bug, write a failing test that reproduces it first, then fix it.
- Use the lowest level that captures the behavior: unit before integration before end to end.
- Tests live in `src/__tests__/` and are named `*.spec.ts`.
- Prefer unit tests for schemas, parsers, compiler behavior, and isolated services.
- Add integration coverage for queue flow, worker orchestration, and module boundaries.
- Keep tests deterministic with fixtures and mocks; mock `playwright` rather than launching a browser.
- Avoid tests that require fragile timing or external network access.

## 14. Documentation

- Keep `README.md` and this file aligned with the real repository structure.
- Document behavior changes when they affect setup, module generation, or runtime flow.
- Keep markdown concise and ASCII-only.
- `apps/docs` (Docusaurus, deployed separately from this repo) is user- and extension-author-facing documentation, distinct from this file and `README.md`. Update the relevant page under `apps/docs/docs/` whenever a change affects a documented environment variable, the `ChallengerExtension`/`ChallengerRegistrar` contract, a DSL action, or a REST endpoint.
- Cross-references from `apps/docs` into this file (e.g. a section number) are not build-checked — grep `apps/docs/docs/` for stale references whenever a section here is renumbered.

## 15. Security and Compliance

- Never log secrets or credentials.
- Keep sensitive values in environment variables or a secrets manager.
- Respect site terms, rate limits, and configured network policies.
