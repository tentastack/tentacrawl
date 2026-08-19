---
title: Intercepting Requests and Responses
sidebar_position: 3
description: Rewrite, block, or fulfill requests, or rewrite an origin response, before the page sees it.
---

# Intercepting Requests and Responses

`onRequest` / `onResponse` (see the [overview](/extending/overview)) are observe-only — useful for detecting a challenge, not for stopping one. Two dedicated capabilities add real mutation, both routed through a single `context.route` seam so only one route handler is ever installed per page.

## Request interception

Capability `request-intercept`, registrar method `interceptRequest`. **First-terminal-wins**: handlers run in priority order until one calls `abortRequest()` or `fulfillRequest()`, or every handler has had a chance to `modifyRequest()` (URL, method, headers, body).

```ts
r.interceptRequest(async (ctx) => {
  if (looksLikeTracker(ctx.request.url)) {
    ctx.route.abortRequest('blockedbyclient');
  }
}, { routePatterns: ['**/*'], resourceTypes: ['image', 'stylesheet'] });
```

## Response interception

Capability `response-intercept`, registrar method `interceptResponse`. An **ordered pipeline** — each handler sees the previous handler's `modifyResponse()` output, so multiple extensions can layer transformations on the same response body.

```ts
r.interceptResponse(async (ctx) => {
  if (ctx.response.isBinary) return;
  if (isInterstitial(ctx.response.body)) {
    await ctx.helpers.emitSignal({ signalType: 'page.interstitial-detected', severity: 'warn' });
  }
}, { routePatterns: ['**/*'], resourceTypes: ['document'] });
```

## Always filter

This seam sees *every* request on the page. Always constrain `routePatterns` and/or `resourceTypes`.

## Failure behavior

Both paths fail open: if a handler throws, or the upstream fetch itself fails (dead proxy, DNS, TLS), the request is served unmodified rather than left hanging. Capability gating is enforced here specifically — registering `interceptRequest`/`interceptResponse` handlers without declaring the matching capability gets them silently dropped at collection time, with a warning logged.

## Next steps

- [Manage Extensions](/guides/manage-extensions) — capability declarations show up in the Extensions admin list.
- [Signals and Diagnostics](/architecture/signals-and-diagnostics) — `route.decided` and `route.response-modified` are emitted automatically whenever a handler acts.
