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
pnpm typecheck
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

## Continuous Integration

Every pull request and every push to `main` runs `.github/workflows/ci.yml`, which
gates on four jobs: `lint`, `test`, `build`, and `generated`. The `generated` job
re-runs `pnpm generate` and fails if the committed registries differ, so the local
checks above are the same checks CI runs.

The `CI` job aggregates the four and is the single check to require in branch
protection.

## Commit and Pull Request Titles

The project follows [Conventional Commits](https://www.conventionalcommits.org/).
Pull requests are squash merged, so the pull request title becomes the commit
message on `main` and determines the next release version.

```
<type>(<scope>): <subject>
```

- Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`,
  `style`, `chore`, `revert`.
- Scope is optional and names the package or app the change belongs to, without
  the `@tentacrawl/` prefix: `feat(challenger): ...`, `fix(scraper,crawler): ...`.
- Write the subject in lowercase, in the imperative, with no trailing period.
- Mark a breaking change with `!` after the type or scope, or with a
  `BREAKING CHANGE:` footer.

`feat` bumps the minor version, `fix` and `perf` bump the patch version, and the
remaining types do not release on their own. While the project is below `1.0.0`,
a breaking change bumps the minor version rather than declaring `1.0.0`.

`.github/workflows/pr-title.yml` enforces this on the pull request title.

## Releases

Releases are automated with
[release-please](https://github.com/googleapis/release-please). It is not run by
hand.

1. Merging a pull request into `main` triggers `.github/workflows/release.yml`.
2. release-please opens (or updates) a release pull request that bumps the
   version in `package.json` and writes the new `CHANGELOG.md` entries.
3. That pull request stays open and keeps absorbing further merges to `main`.
4. Merging the release pull request tags the commit `vX.Y.Z` and publishes a
   GitHub Release whose notes are the changelog section for that version.

Cutting a release is therefore a deliberate act: merge the release pull request
when the accumulated changes are worth shipping. Release notes are only as good
as the pull request titles they are generated from.

## Pull Requests

- Describe the behavior change clearly.
- Call out any generated files included in the diff.
- Mention the validation commands you ran.
- Include screenshots for UI changes when they materially affect the admin surface.

## Local Files

Do not commit local-only files such as `.env.local`, logs, screenshots from ad hoc debugging, or OS/editor metadata.