# Proxy Module Rewrite - Specification

Status: Approved
Owner: Platform / Proxy
Audience: Core maintainers and community challenger authors
Scope: `packages/proxy` (rewrite), `packages/core` (network policy + selection contract), `packages/challenger` (registration metadata + API), `packages/ui` (NetworkPolicyField), `packages/crawler` (detail formatting)

## 1. Purpose

The proxy module is rewritten as the canonical best-practices example of a Challenger extension module (see `docs/challenger-framework-spec.md`). Its capabilities are deliberately simple:

- No external proxy provider APIs. BrightData, the provider descriptor/catalog surface, pools, and leases are removed without backward compatibility.
- Operators define proxy servers manually. A proxy server is a named credential scope: one set of optional credentials (`username` / `password`) shared by one or more endpoint URLs. This mirrors how real proxy products hand out many gateway `host:port` endpoints behind one account.
- Each endpoint tracks usage so operators can measure health and performance.
- Scrape and crawl runs select a proxy through a generic, capability-driven mechanism that any future proxy-capable challenger can implement.

The module demonstrates, end to end: a `ChallengerExtension` with `configSchema` and a selection descriptor, module-owned entities and Zod schemas, an API controller, worker-side persistence from challenger handlers, signals, per-run state, a module frontend (list / create / detail with a dynamic row editor), and integration with the run-creation UI.

## 2. Domain model

### 2.1 Proxy server

`ProxyServerEntity` (collection `proxy_servers`):

| Field       | Type                      | Notes                                  |
| ----------- | ------------------------- | -------------------------------------- |
| `id`        | string (uuid)             | primary key                            |
| `name`      | string                    | unique display name                    |
| `enabled`   | boolean                   | disabled servers are never selected    |
| `location`  | string?                   | ISO 3166-1 alpha-2 exit country (e.g. `PL`); helps pick a proxy that bypasses geo restrictions |
| `username`  | string?                   | shared by all endpoints                |
| `password`  | string?                   | shared by all endpoints; never logged  |
| `notes`     | string?                   | free text                              |
| `endpoints` | embedded `ProxyEndpoint[]`| at least one                           |
| `createdAt` / `updatedAt` | Date        |                                        |

Embedded `ProxyEndpoint`:

| Field            | Type    | Notes                                          |
| ---------------- | ------- | ---------------------------------------------- |
| `id`             | string  | stable uuid, assigned on create                |
| `url`            | string  | e.g. `http://gw1.example:8080`                 |
| `timesUsed`      | number  | denormalized counter                           |
| `timesSucceeded` | number  | run outcome `OK`                               |
| `timesFailed`    | number  | run outcome `ERROR` (+ `BLOCKED` if configured)|
| `lastUsedAt`     | Date?   |                                                |
| `lastFailedAt`   | Date?   |                                                |
| `lastError`      | string? | last failure reason                            |

The enabled flag is server-level only. Endpoint identity is stable across updates: updating a server matches incoming endpoint rows to existing ones by `id` (kept by the UI) so counters survive edits; new rows get new ids, removed rows drop their counters.

### 2.2 Usage log

`ProxyUsageEntity` (collection `proxy_usage`), one record per run that received a proxy:

| Field         | Type    | Notes                              |
| ------------- | ------- | ---------------------------------- |
| `id`          | string  |                                    |
| `serverId`    | string  | indexed                            |
| `endpointId`  | string  | indexed                            |
| `endpointUrl` | string  | denormalized for display           |
| `taskId`      | string  | indexed                            |
| `taskType`    | string  | `scrape` / `crawl-page`            |
| `outcome`     | string? | `OK` / `ERROR` / `BLOCKED` / `PRECONDITION_FAILED`; unset while running |
| `error`       | string? |                                    |
| `startedAt`   | Date    |                                    |
| `finishedAt`  | Date?   |                                    |
| `durationMs`  | number? |                                    |

Counters on the endpoint are updated together with the usage record when the run outcome arrives. Credentials never appear in usage records or signals.

## 3. Core contract changes (`packages/core`)

### 3.1 Managed network policy

`network-policy.schema.ts`: the `managed` variant no longer references a pool. It references a proxy-capable challenger extension and, optionally, a specific server within it:

```ts
z.object({
  mode: z.literal('managed'),
  extension: z.string().min(1),   // fully-qualified key, e.g. 'proxy/manual'
  serverId: z.string().optional(), // omitted = extension picks automatically
})
```

`none` and `static` modes are unchanged.

### 3.2 Generic selection contract

`challenger-contract.ts` gains an optional, declarative selection descriptor so the web UI can offer "pick an extension, then pick one of its options" for any capability without hardcoding module knowledge:

```ts
export interface ChallengerSelectionDescriptor {
  capability: ChallengerCapability;  // which capability this selection serves
  optionsPath: string;               // API path returning ChallengerSelectionOption[]
  autoLabel?: string;                // label for the implicit 'auto' choice
}
export interface ChallengerSelectionOption {
  value: string;                     // e.g. proxy server id
  label: string;
  description?: string;
  disabled?: boolean;
}
```

`ChallengerExtension` gains `readonly selection?: ChallengerSelectionDescriptor`. The options endpoint is served by the owning module's own API controller; the descriptor only points at it.

## 4. Challenger host changes (`packages/challenger`)

- `ChallengerRegistrationEntity` gains `selection?: ChallengerSelectionDescriptor` (json, nullable); the registration sync copies it from the extension.
- `ChallengerListItem` schema and `ChallengerApiService.toListItem` expose `selection`.
- `GET /challengers` accepts an optional `?capability=<ChallengerCapability>` filter so the run-creation UI can ask for proxy-capable extensions directly.

## 5. Proxy module rewrite (`packages/proxy`)

### 5.1 Removed

- `provider/` (BrightData provider + config, descriptor, interface, catalog), `undici.d.ts`.
- `api/proxy-pool.controller.ts`, `api/proxy-pool.service.ts`.
- Pool/lease entities and schemas, the pool frontend pages and hooks.

### 5.2 Data (`src/data`)

- `entities.ts`: `ProxyServerEntity` with embedded `ProxyEndpointEmbeddable`, `ProxyUsageEntity` (section 2).
- `schemas.ts`: Zod schemas and DTOs shared by API and frontend:
  - `proxyServerSchema`, `proxyEndpointSchema` (with stats), `proxyUsageSchema`.
  - `createProxyServerDto` / `updateProxyServerDto`: `name`, `enabled`, `username?`, `password?`, `notes?`, `endpoints: [{ id?, url }]` (min 1, urls validated and non-empty).
  - `proxyExtensionConfigSchema`: `{ rotation: 'round-robin' | 'random' (default 'round-robin'), countBlockedAsFailure: boolean (default true) }` - the challenger `configSchema`, also consumed by the settings UI.

### 5.3 API (`src/api`)

`ProxyServerController` (`/proxy`) + `ProxyServerService`:

- `GET /proxy/servers` - filtered, sorted, paginated list returning `{ data, total }` (crawl/scrape list pattern). Query is validated by `listProxyServersQuerySchema`: `name` / `endpoint` (case-insensitive, regex-escaped partial match on server name / endpoint URL), `enabled` (`true` / `false`), `location` (alpha-2 code), `usage` (`used` = some endpoint used, `unused` = no endpoint used, `failing` = some endpoint failed), `limit` (max 100, default 20), `offset`, `sort` (`name` / `enabled` / `location` / `createdAt` / `updatedAt`), `order`.
- `GET /proxy/servers/locations` - distinct location codes in use, feeding the list filter dropdown.
- `POST /proxy/servers`, `PUT /proxy/servers/:id`, `DELETE /proxy/servers/:id` - CRUD, Zod-validated, endpoint identity preserved on update (2.1).
- **Credential masking**: list and detail responses never include `password`. Each server is mapped to a `ProxyServerResponse` that carries `hasPassword: boolean` instead of the value. `PUT` follows a leave-blank-to-keep convention: the password is overwritten only when a non-empty value is supplied, so the edit form (which starts blank) round-trips without ever receiving the stored secret. The worker `ProxyManagerService` reads the real credentials directly from the entity, so masking has no effect on run-time proxying.
- `GET /proxy/servers/options` - `ChallengerSelectionOption[]` for the run-creation UI (enabled servers; disabled ones included with `disabled: true`; location code surfaced in the description so operators can pick a geo-appropriate server).
- `GET /proxy/servers/:id/usage?limit=` - recent `ProxyUsageEntity` records.

### 5.4 Worker (`src/worker`)

`ProxyManagerService`:

- `acquire(input: { taskId, taskType, serverId? })` - resolves the target server (specific id, else any enabled server), requires `enabled` and at least one endpoint, picks an endpoint per rotation strategy (`round-robin` = least-recently-used by `lastUsedAt`; `random`), increments `timesUsed` / `lastUsedAt`, inserts a `ProxyUsageEntity`, returns `{ server, username, password, usageId }` or `null`.
- `recordOutcome(usageId, outcome, error?)` - finalizes the usage record and updates the endpoint counters (`timesSucceeded` for `OK`; `timesFailed` + `lastFailedAt` + `lastError` for `ERROR`, and `BLOCKED` when `countBlockedAsFailure`).

`ProxyChallengerExtension` (`proxy/manual`) - the reference implementation:

- Identity: `moduleId: 'proxy'`, `extensionId: 'manual'`, `capabilities: ['proxy']`, `priority: 10`.
- `configSchema: proxyExtensionConfigSchema`; the validated config arrives as `ctx.config` per run.
- `selection: { capability: 'proxy', optionsPath: '/proxy/servers/options', autoLabel: 'Auto (any enabled server)' }`.
- `register(registrar)`:
  - `onBootstrapContext` (mutating, priority 10): when `networkPolicy.mode === 'managed'` and `networkPolicy.extension` equals this extension's key, call `acquire(...)`; on success `helpers.setProxyCandidate(...)` and stash `usageId` in `ctx.state`; on failure emit signal `proxy.no-server-available` (severity `warn`) and leave the run direct.
  - `onRunOutcome` (observer): read `usageId` from `ctx.state`, call `recordOutcome(usageId, ctx.outcome, reason)`; emit `proxy.endpoint-failed` (severity `warn`) on failed outcomes.
- `onError(ctx, error)`: safety net - if a `usageId` is still pending (run crashed before the outcome stage), record it as `ERROR`.
- Static mode (`networkPolicy.mode === 'static'`) is also honored here by passing the inline proxy through `setProxyCandidate`, keeping proxy behavior owned by one extension.

### 5.5 Frontend (`src/frontend`)

Routes (in `metadata`): `proxy` (list), `proxy/new`, `proxy/:id` with pages `proxy-server-list` / `proxy-server-create` / `proxy-server-detail`. Navigation stays nested under `/extensions`.

- **List page**: server-side filtered and paginated `DataTable` (mirrors the crawl list): `FilterBar` with name and endpoint text filters (debounced), enabled, location (distinct codes from `/proxy/servers/locations`, shown as country names), and usage selects; sortable name / status / location columns; page-size control. Columns: name + endpoint URLs, enabled badge, location, endpoint count, aggregated uses / failures / success rate, last used. Side panel "Extension settings": typed form for `proxyExtensionConfigSchema` (rotation select, blocked-as-failure switch) reading and writing `GET/PUT /challengers/proxy%2Fmanual/config` - demonstrating the per-extension config surface with a module-owned UI.
- **Create page**: `CrudForm` for name / enabled / location / username / password / notes plus a custom `EndpointListField` rendered exactly like the header rows in the scrape/crawl forms: one URL input per row, add / remove buttons, minimum one row. Location uses the shared `CountryField` (filterable searchable select, same pattern as the scrape/crawl locale field), storing the ISO alpha-2 code.
- **Detail page**: same edit form, plus a per-endpoint stats table (uses, succeeded, failed, success rate, last used, last error) and a recent-usage panel (`GET /proxy/servers/:id/usage`), plus delete with confirm dialog.

Hooks in `hooks/use-proxy-servers.ts` own all API interaction (TanStack Query + `apiCall` / `apiCallOrThrow`, `flash()` feedback).

## 6. Run-creation integration (`packages/ui`)

`NetworkPolicyField` managed mode is rewritten:

1. Fetch `GET /challengers?capability=proxy`. Render a select of proxy-capable extensions (label `moduleId/extensionId`, disabled entries excluded). With exactly one, preselect it.
2. For the chosen extension with a `selection` descriptor, fetch `selection.optionsPath` and render a second select: the implicit auto option (`selection.autoLabel`, stores `serverId: undefined`) plus one entry per option.
3. Persist `{ mode: 'managed', extension, serverId? }`.
4. Empty states: no proxy-capable extension installed, or extension without options, show a hint instead of the selects.

No scraper/crawler form code changes are needed beyond what flows through the shared schema; `packages/crawler` crawl detail formatting switches from `poolId` to `extension` + `serverId`.

## 7. Best practices demonstrated

| Practice                                        | Where                                            |
| ----------------------------------------------- | ------------------------------------------------ |
| Self-registration on `OnModuleInit`             | `ProxyChallengerExtension`                       |
| Granular handlers over coarse hooks             | `onBootstrapContext` / `onRunOutcome`            |
| Mutation only through `helpers`                 | `setProxyCandidate`                              |
| Per-run scratch via `ctx.state`                 | pending `usageId`                                |
| Validated per-extension config (`ctx.config`)   | `proxyExtensionConfigSchema`                     |
| Custom signals for observability                | `proxy.no-server-available`, `proxy.endpoint-failed` |
| Selection descriptor for run-creation UI        | `selection` + `/proxy/servers/options`           |
| Module-owned entities, schemas, API, frontend   | deterministic layout per AGENTS.md section 9     |
| Secrets hygiene                                 | credentials never logged, never in signals/usage, never returned by the API (`hasPassword` + leave-blank-to-keep) |

## 8. Testing

- `proxy-manager.service.spec`: rotation strategies, specific vs auto server resolution, disabled-server exclusion, counter and usage-record updates per outcome, `countBlockedAsFailure` behavior.
- `proxy.challenger.spec` (rewritten): managed policy targeting this extension acquires and stores state; foreign extension key is ignored; static policy passes through; outcome recording and the `onError` safety net; no-server signal emission.
- `schemas.spec`: DTO validation (min one endpoint, url format, alpha-2 location), list query coercion/defaults/limits, config schema defaults.
- `proxy-server-filter.spec`: list filter construction (regex escaping, enabled/location, usage variants).
- Core `schema.spec`: managed policy shape updated.

## 9. Verification

`pnpm generate` after metadata changes; package-level `tsc` builds for core, challenger, proxy, ui, crawler, scraper; jest suites for core and proxy.
