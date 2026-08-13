---
title: Environment Variables
sidebar_position: 1
description: Every runtime environment variable, by application.
---

# Environment Variables

Configuration is validated with Zod at startup (`packages/core/src/config.schema.ts`); an invalid value fails fast rather than falling back silently.

## API (`apps/api/.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | — | `development` \| `production` |
| `PORT` | `3000` | HTTP port |
| `LOG_LEVEL` | `info` | pino log level |
| `MONGO_URI` | — | MongoDB connection string |
| `MONGO_DB_NAME` | — | Database name |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | — | BullMQ / Redis connection |
| `CORS_ORIGIN` | — | Comma-separated allowed origins |

## Worker (`apps/worker/.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV`, `PORT` (`3002`), `LOG_LEVEL`, `MONGO_URI`, `MONGO_DB_NAME`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | | Same meaning as the API's |
| `BROWSER_POOL_MAX` | `4` | Max concurrent pooled browser processes; see [Browser Execution and Pooling](/architecture/browser-execution) |
| `CHALLENGER_CONFIG_CACHE_TTL_MS` | `3000` | How long the Challenger dispatcher caches extension config/enable flags before re-reading them; `0` disables caching for strictly live toggles |
| `CHALLENGER_ALLOWED_CAPABILITIES` | unset (all allowed) | Comma-separated allowlist of `ChallengerCapability` values |

## Web (`apps/web`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Base URL the admin UI calls |

## Admin and notification (module-level tuning, safe defaults)

`ADMIN_DASHBOARD_DEFAULT_LIST_LIMIT`, `ADMIN_WORKER_HEARTBEAT_INTERVAL_MS`, `ADMIN_WORKER_HEALTHY_THRESHOLD_MS`, `ADMIN_WORKER_STALE_THRESHOLD_MS`, `ADMIN_WORKER_SUPPORTED_MODULES`, `ADMIN_WORKER_SUPPORTED_QUEUES`, `NOTIFICATION_DEFAULT_LIST_LIMIT` — module-owned tuning knobs with safe defaults; only set these when you need to change the behavior.

Never commit `.env.local` files. Local-only overrides belong there, not in version control.
