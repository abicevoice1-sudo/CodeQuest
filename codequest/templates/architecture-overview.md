# Architecture overview: <repo name>

> Generated with CodeQuest (`/codequest-map`). Seed data: `./bin/codequest scan` → `.codequest/graph.json`.

## The 60-second version

_(3 sentences: what this repo does, for whom, how it's built)_

## System graph

```
[Entry] --> [API Route] --> [Service] --> [Data Access] --> [Model/Schema]
```

## Layer inventory

### Entry

- `path/to/file.ts:1` — _(one-line purpose)_

### API Route

_(…repeat per layer present…)_

## Central modules (top 10 by dependents)

| Module | Layer | Dependents | Risk |
|---|---|---|---|
| `path/to/file.ts` | Service | 12 | `[HIGH RISK]` |

## Hotspots

- `[CRITICAL RISK]` `path/to/file.ts` — _(one-line justification)_

## Gaps

- Untested critical paths: …
- Orphan modules: …
- Circular imports: … _(verified by reading)_

## Verdict

_(the single architectural fact a new tech lead must know — one line)_
