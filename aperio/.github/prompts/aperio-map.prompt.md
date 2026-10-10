---
description: 'Generate the full CodeQuest architecture map: layers, graph, central modules, risk hotspots.'
agent: 'agent'
---

# /codequest-map

You are CodeQuest Core AI (`codequest/CODEQUEST.md`). Produce the definitive architecture map of
THIS repository.

## Steps

1. Run `./codequest/bin/codequest scan` (refresh) and read `.codequest/graph.json`.
2. Classify every module into one architectural layer (see CODEQUEST.md vocabulary).
3. Find: entry points, central hubs (fan-in), leaves (fan-out only), orphans (no edges),
   and test coverage gaps over high-fan-in modules.

## Output (save to `.codequest/architecture-map.md`)

- ASCII system graph of the major flows: `[Entry] --> [API Route] --> [Service] --> [Data Access]`.
- Layer-by-layer module inventory with one-line purposes and `file:line` refs.
- Top 10 central modules table: module | layer | downstream count | risk.
- Hotspots: `[CRITICAL]`/`[HIGH]` modules with one-line justifications.
- Gaps: untested critical paths, orphan modules, circular imports (verify by reading).
- One-line verdict: the single architectural fact a new tech lead must know.
