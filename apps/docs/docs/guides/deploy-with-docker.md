---
title: Deploy with Docker
sidebar_position: 5
description: Run the full Tentacrawl stack in containers.
---

# Deploy with Docker

## Dependencies only (local app development)

```bash
pnpm dev:deps
pnpm dev:deps:logs
pnpm dev:deps:down
```

Starts MongoDB and Redis only, so `apps/api`, `apps/worker`, and `apps/web` can run natively with `pnpm dev:apps`. This is the default local workflow; it deliberately does not boot the full app stack.

## Full stack in containers

```bash
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

This uses `docker-compose.fullapp.yml` and starts MongoDB (`27017`), Redis (`6379`), the API (`3000`), the worker (`3002`), and the web app (`3001`).

Override any port or the API URL the web app targets:

```bash
API_PORT=4000 WEB_PORT=4001 WORKER_PORT=4002 pnpm docker:up
NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm docker:up
```

To reset all container data:

```bash
docker compose down -v
docker compose -f docker-compose.fullapp.yml down -v
```

## Health checks

Both the API and worker expose `/health` (readiness — verifies MongoDB and Redis, returns 503 if either is down), `/health/ready` (same check), and `/health/live` (liveness only, no dependency checks). Point your orchestrator's liveness probe at `/health/live` and its readiness probe at `/health/ready`.

## Configuration in containers

Runtime configuration is validated with Zod at startup. Pass environment variables through your container platform rather than committing `.env` files — see the [Environment Variables reference](/reference/environment-variables) for the full list, including optional tuning (`BROWSER_POOL_MAX`, `CHALLENGER_CONFIG_CACHE_TTL_MS`, `CHALLENGER_ALLOWED_CAPABILITIES`).
