# Docker Workflows

Tentacrawl uses two Docker modes.

## 1. Dependencies Only

Use this when you want the best developer experience for app code and only need MongoDB and Redis in containers.

Commands:

```bash
pnpm dev:deps
pnpm dev:deps:logs
pnpm dev:deps:down
```

This mode uses the root `docker-compose.yml` and starts only:

- MongoDB
- Redis

This is the default Docker path used by `pnpm dev`.

## 2. Full Stack

Use this when you want everything in containers.

Commands:

```bash
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

This mode uses `docker-compose.fullapp.yml` and starts:

- MongoDB
- Redis
- API
- Worker
- Web

## Environment Overrides

You can override host ports and selected runtime settings:

```bash
API_PORT=4000 WEB_PORT=4001 WORKER_PORT=4002 pnpm docker:up
MONGO_PORT=37017 REDIS_PORT=36379 pnpm dev:deps
MONGO_DB_NAME=tentacrawl_local pnpm docker:up
NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm docker:up
```

## Why The Split Exists

The dependency-only compose file is the safest default for daily development:

- faster startup
- fewer rebuilds
- fewer Docker-specific file watching issues
- no confusion about whether source changes should be made on the host or in containers

The full-stack compose file is explicit so containerized runs are intentional.

## Resetting Data

Dependencies-only data reset:

```bash
docker compose down -v
```

Full-stack data reset:

```bash
docker compose -f docker-compose.fullapp.yml down -v
```

Both commands delete the MongoDB and Redis named volumes for that compose project.

## Notes

- No `container_name` values are set on purpose. That keeps Compose project isolation intact and avoids conflicts across clones or parallel environments.
- The default Docker build context excludes local artifacts, secrets, and editor files.
- The current Docker setup is optimized for quick local infrastructure and quick full-stack runs, not for hot-reload development inside containers.