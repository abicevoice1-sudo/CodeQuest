# Blast radius: `<file>`

> Generated with CodeQuest (`/codequest-blast-radius`). Seed data: `./bin/codequest blast-radius <file>`.

## Module identity

- **Purpose:** _(one architectural sentence)_
- **Layer:** _(Entry / API Route / Middleware / Service / Domain / Data Access / Model/Schema / UI Component / State / Shared Utility / Config / Test / Script)_
- **Risk:** `[CRITICAL RISK]` / `[HIGH RISK]` / `[MEDIUM RISK]` / `[LOW RISK]` — _(one-line justification: downstream count, centrality, test coverage)_

## Upstream (what this module imports)

| File | Line | Notes |
|---|---|---|
| `path/to/dep.ts` | :42 | |

## Downstream dependents

### 1st degree (direct importers)

- `path/to/file.ts`

### 2nd degree (transitive)

- `path/to/file.ts`

### 3rd degree (transitive)

- `path/to/file.ts`

## Graph fragment

```
[Caller] ---> [Module: method()] ---> [Data Model]
```

## Affected tests

- `path/to/test.ts` — _(re-run)_
- _(none found — coverage gap)_

## Verdict

_(ship it / ship with tests / stop and refactor first — one line)_
