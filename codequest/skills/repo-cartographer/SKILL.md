---
name: repo-cartographer
description: Map an unfamiliar codebase into a navigable architecture map. Use when onboarding onto a repo, answering "how is this structured", or before any large refactor. Produces layers, entry points, central modules, and risk hotspots grounded in static analysis.
---

# repo-cartographer

Turn a raw repository into a CodeQuest architecture map.

## Workflow

1. **Scan.** Run `./codequest/bin/codequest scan` in the repo root (Node 18+, zero deps,
   fully offline). This writes `.codequest/graph.json` (modules, import edges, metrics)
   and `.codequest/repo-map.md`. Re-scan after big refactors.
2. **Classify.** Assign every module exactly one layer: `Entry` · `API Route` · `Middleware` ·
   `Service` · `Domain` · `Data Access` · `Model/Schema` · `UI Component` · `State` ·
   `Shared Utility` · `Config` · `Test` · `Script`. Use path signals (`routes/`, `models/`,
   `components/`…) plus a direct read of ambiguous files.
3. **Find the load-bearing walls.** From the graph: top fan-in modules (most dependents),
   entry points, orphans (no edges), and circular imports. Verify surprises by reading the files.
4. **Write the map.** Fill `codequest/templates/architecture-overview.md` and save to
   `.codequest/architecture-map.md`.

## Rules

- Every edge in the map must exist in `.codequest/graph.json` or in code you read yourself.
- Every module reference carries `file:line`.
- End with the one architectural fact a new tech lead must know.
