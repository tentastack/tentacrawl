---
title: DSL Grammar
sidebar_position: 3
description: Every base DSL action and the fields it requires.
---

# DSL Grammar

A DSL document is `{ name: string, steps: Step[] }`. Every step has an `action` plus a subset of these fields, validated by `packages/dsl/src/dsl.schema.ts`:

| Field | Type | Meaning |
| --- | --- | --- |
| `selector` | `string` | CSS selector |
| `value` | `string` | Navigation URL, fill value, or wait duration depending on the action |
| `outputKey` | `string` | Key under which the result is stored in the run's artefact |
| `attr` | `string` | Attribute name, for `extractAttr` |
| `condition` | `string` | `contains` \| `notContains` \| `exists` \| `notExists`, for `assert` |
| `timeoutMs` | `number` | Per-step timeout override |

## Base actions

| Action | Required fields |
| --- | --- |
| `goto` | `value` (the URL) |
| `click` | `selector` |
| `fill` | `selector`, `value` |
| `waitFor` | `selector` |
| `wait` | `value` (duration) |
| `extractText` | `selector`, `outputKey` |
| `extractHtml` | `selector`, `outputKey` |
| `extractAttr` | `selector`, `outputKey`, `attr` |
| `extract` | `selector`, `outputKey` |
| `screenshot` | `outputKey` |
| `saveSource` | `outputKey` |
| `assert` | `selector`, `condition`; `value` also required when `condition` is `contains` or `notContains` |

This set is fixed and intentionally use-case agnostic — it never grows a site-specific verb. A [Challenger extension](/extending/add-a-dsl-action) can register additional actions; the compiler unions each extension's schema into the step type, and the registry rejects any name that collides with a base action or another extension's action.

See [Write DSL Flows](/guides/write-dsl-flows) for a complete working example.
