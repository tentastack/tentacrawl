---
title: Manage Extensions
sidebar_position: 4
description: Enable, disable, configure, and inspect Challenger extensions from the admin UI.
---

# Manage Extensions

Every installed [Challenger extension](/extending/overview) — in-tree or community — is visible and controllable from **Extensions** in the admin sidebar, without editing config files or redeploying.

## List view

Shows every registered extension as `moduleId/extensionId` (for example `proxy/manual`), its version, declared capabilities, a status badge, and an enable/disable toggle. Toggling takes effect on the *next* run; the dispatcher reads the enabled flag per run, so there is no restart or regeneration step.

## Detail view

Per-extension: capabilities, last error, and a recent-signals panel — the diagnostic trail for that extension's runs (see [Signals and Diagnostics](/architecture/signals-and-diagnostics)). There is deliberately no generic configuration editor here: each extension that needs configuration ships its own settings UI, because only the extension author knows its shape and constraints. The proxy module's rotation and failure-counting settings are the reference example.

## Status lifecycle

An extension is `active` while a running worker loads it. Removing a module from `modules.config.ts` and redeploying marks its registration `archived` rather than deleting it — configuration and signal history are retained. An archived extension never runs. **Purge** on the detail page permanently deletes an archived extension's registration, config, and signals; an active extension must be archived first (remove it from `modules.config.ts` and regenerate).

## Next steps

- [Configure a Proxy](/guides/configure-a-proxy) for a concrete example of an extension with its own settings UI.
- [Signals and Diagnostics](/architecture/signals-and-diagnostics) to understand what shows up in the signals panel and why.
