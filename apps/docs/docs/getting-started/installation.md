---
title: Installation
sidebar_position: 1
description: Install dependencies and start the local Tentacrawl stack.
---

# Installation

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for local MongoDB and Redis)

## Install and generate

```bash
pnpm install
pnpm exec playwright install chromium
pnpm generate
```

`pnpm generate` reads `modules.config.ts` and writes the committed registries that wire enabled modules into `apps/api`, `apps/worker`, and `apps/web`. Run it again any time you change `modules.config.ts` or a module's metadata.

## Start everything

```bash
pnpm dev
```

This starts MongoDB and Redis via Docker Compose, then the API, worker, and web app, with prefixed logs in one terminal:

| App | URL |
| --- | --- |
| Web (admin UI) | `http://localhost:3001` |
| API | `http://localhost:3000` |
| Worker health | `http://localhost:3002/health` |

If MongoDB and Redis are already running elsewhere, use `pnpm dev:apps` instead to skip Docker Compose.

## Configuration

Runtime configuration is validated with Zod (`packages/core/src/config.schema.ts`). For local development, create `apps/api/.env.local` and `apps/worker/.env.local` with at least:

```dotenv
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=tentacrawl
REDIS_HOST=localhost
REDIS_PORT=6379
```

The full list of variables, including optional runtime tuning for the browser pool and the Challenger dispatcher, is in the [Environment Variables reference](/reference/environment-variables).

## Next step

Continue to [Your First Scrape](/getting-started/quickstart).
