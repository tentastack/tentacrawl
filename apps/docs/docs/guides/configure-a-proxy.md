---
title: Configure a Proxy
sidebar_position: 3
description: Add a proxy server and route a scrape or crawl through it.
---

# Configure a Proxy

`packages/proxy` is a Tentacrawl module that manages manually defined proxy servers with endpoint rotation and usage tracking. It ships as the reference [Challenger extension](/extending/overview), so it doubles as a working example of the extension contract.

## Add a server

In the admin UI, go to **Extensions → Proxy Servers → New**. A server has:

- shared credentials (username/password), used by every endpoint on the server
- one or more endpoint URLs
- a rotation strategy: `round-robin` or `random`

Use **Test** on an endpoint before saving — it proxies a real request through the candidate server to `ipinfo.io` and returns IP, city, region, country, org, and latency, so a dead or misconfigured endpoint fails here instead of on your first real run.

## Route a run through it

A run's proxy behavior is decided by its `NetworkPolicy`, which has three modes:

- `none` — no proxy.
- `static` — a fixed server/username/password supplied directly with the run.
- `managed` — delegated to a Challenger extension by its fully-qualified key (`proxy/manual` for this module), optionally pinned to one `serverId`. This is how the proxy module selects and rotates endpoints per the configured strategy.

Set the network policy when creating a scrape or crawl in the admin UI, or in the API payload directly.

## Endpoint health and failures

Each use is recorded with an outcome. Whether a `BLOCKED` result also counts as an endpoint failure is controlled by the extension's own setting (`countBlockedAsFailure`, on by default) in its settings dialog under **Extensions**. Recent usage and endpoint health are visible on the proxy server's detail page.

## Next steps

- [Manage Extensions](/guides/manage-extensions) to enable, disable, or inspect any Challenger extension, including this one.
- [Extending Tentacrawl](/extending/overview) if you want to build your own proxy provider integration instead of manually defined servers.
