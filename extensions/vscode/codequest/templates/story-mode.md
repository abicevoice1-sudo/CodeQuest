# Story: <feature name>

> Generated with CodeQuest (`/codequest-story`). Static dependency trace unless noted otherwise.

## Entry point

`path/to/entry.ts:1` — _(why this is the entry: route handler / CLI command / UI action)_

## Step trace

| # | File:line | Hop | Payload / side effects |
|---|---|---|---|
| 1 | `a.ts:10` | `handler()` receives request | params in: …; state mutated: …; returns: … |
| 2 | `b.ts:22` | `service.do()` called | |

## Flow

```
[Entry] --> [API Route: handler()] --> [Service: method()] --> [Data Model]
```

## Narration script

1. _(spoken-style caption for step 1 — onboarding-audio ready)_
2. _(…)_

## Edge cases spotted

- _(unhandled error / missing auth check / … — each verified by reading)_
