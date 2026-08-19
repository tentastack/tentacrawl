---
title: Write DSL Flows
sidebar_position: 2
description: Write a multi-step YAML flow instead of a single-page scrape.
---

# Write DSL Flows

A simple scrape fetches one URL and collects artefacts. A **DSL flow** is a YAML document listing steps — navigate, click, wait, extract, screenshot — that runs as a scripted browser session. Use it when a page needs interaction (pagination, forms, waiting for content) before you can extract anything useful.

## A working example

```yaml
name: example-page-scraper
steps:
  - action: goto
    value: "https://quotes.toscrape.com/"

  - action: waitFor
    selector: ".quote"

  - action: extractText
    selector: ".quote:first-child .text"
    outputKey: "first_quote_text"

  - action: extractAttr
    selector: ".quote:first-child span a"
    attr: "href"
    outputKey: "first_author_link"

  - action: click
    selector: ".pager .next a"

  - action: waitFor
    selector: ".quote"

  - action: screenshot
    outputKey: "listing_screenshot"
```

Each step's `outputKey` becomes a field in the run's JSON artefact.

## Base actions

`goto`, `click`, `fill`, `waitFor`, `extractText`, `extractHtml`, `extractAttr`, `extract`, `screenshot`, `wait`, `saveSource`, `assert`. The full field-level grammar (which fields each action requires) is in the [DSL Grammar reference](/reference/dsl-grammar).

If you need a step type this list doesn't cover (submit a captcha solution, replay a login), a [Challenger extension](/extending/add-a-dsl-action) can register a new action name, and it becomes usable in YAML exactly like a base action.

## Try it locally

`packages/browser` ships a headed sandbox for iterating on a flow without going through the API or worker:

```bash
pnpm sandbox packages/browser/sandbox/fixtures/example-scrape.yaml
```

## Next steps

- [DSL Grammar reference](/reference/dsl-grammar) for the full per-action field requirements.
- [Add a Custom DSL Action](/extending/add-a-dsl-action) to extend the grammar from an extension.
