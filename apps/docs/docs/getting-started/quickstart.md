---
title: Your First Scrape
sidebar_position: 2
description: Run a single-page scrape from the admin UI and inspect the result.
---

# Your First Scrape

This walks through the shortest path from a running stack to a finished scrape, using the admin UI started in [Installation](/getting-started/installation).

1. Open `http://localhost:3001`. The web app redirects `/` to `/dashboard`.
2. Go to **Page Scraper** in the sidebar, then **New Scrape**.
3. Enter a URL and choose which artefact formats to collect (markdown, JSON, HTML, metadata, screenshot, links). Markdown and metadata are on by default.
4. Submit the scrape. It is enqueued on BullMQ and picked up by `apps/worker`, which launches a hardened Playwright context, navigates, and collects artefacts.
5. Open the scrape's detail page to see the outcome (`OK`, `BLOCKED`, `PRECONDITION_FAILED`, or `ERROR`) and the collected artefacts.

## What just happened

The worker ran the request through `packages/browser`, and — because the `challenger` and `proxy` modules are enabled by default — through the Challenger dispatcher as well, even though this simple scrape used no proxy and no custom extension. Every run passes through the same dispatch pipeline; extensions opt in to the stages they care about.

## Next steps

- Run a multi-page crawl instead of a single scrape: the **Website Crawler** module works the same way, with depth and URL-filtering controls.
- Point a run through a proxy: [Configure a Proxy](/guides/configure-a-proxy).
- Understand what just ran under the hood: [The Challenger Framework](/architecture/challenger-framework).
- Write your own extension: [Extending Tentacrawl](/extending/overview).
