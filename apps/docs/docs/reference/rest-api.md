---
title: REST API
sidebar_position: 2
description: The API's base resources, conventions, and current state.
---

# REST API

The API (`apps/api`, default `http://localhost:3000`) exposes one controller per module, mounted at the module's own base path:

| Base path | Module |
| --- | --- |
| `/scrape` | scraper |
| `/crawl` | crawler |
| `/proxy` | proxy |
| `/challengers` | challenger (extensions admin: list, enable/disable, config, health, signals) |
| `/dashboard` | admin |
| `/notifications` | notification |
| `/health`, `/health/ready`, `/health/live` | platform health |
| `/metrics` | Prometheus metrics |

## Conventions

- Every request is tagged with a correlation id: pass `x-correlation-id`, or the API generates one and echoes it back. Worker logs and Challenger signals for a run carry the same id, so a single header value ties a request to its downstream job.
- `/health` and `/health/ready` verify MongoDB and Redis and return `503` if either is unreachable; `/health/live` is dependency-free and always returns `200` once the process is up.
- Request and response bodies are validated with Zod schemas shared from each module's `data/schemas.ts`.

## Current state

There is no authentication layer today, and no generated OpenAPI/Swagger document — the controllers under `packages/*/src/api/*.controller.ts` and `apps/api/src/*` are the source of truth for the exact route and payload shape of each endpoint. Deploying this outside a trusted network requires putting authentication in front of it yourself. Generating an OpenAPI spec from the existing NestJS controllers (`@nestjs/swagger`) is a natural next step for this page rather than hand-maintaining a route table here.
