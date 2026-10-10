# CodeQuest parser — capabilities & honest limits

`bin/codequest` is a **deterministic static scanner**, not a full compiler frontend. It trades
exhaustiveness for zero dependencies and offline operation. This document states exactly what
it does and where it stops, so no one mistakes its output for a type-checked build.

## What it parses (per language)

| Language | Imports | Exports | Notes |
|---|---|---|---|
| JS/TS/JSX/TSX | `import`/`export…from`, `require()`, dynamic `import()`, `export * from` (barrels) | named, default, `export {}`, `module.exports` | `import type` handled; path aliases resolved via tsconfig/jsconfig `paths` |
| Python | `import x`, `from x import y`, relative (`from . import x`, `from ..pkg import y`) | top-level `def`/`class` | absolute imports resolved against repo root |
| Go | `import "x"` + import blocks | exported (`Uppercase`) funcs | module-path imports treated as external |
| Java | `import a.b.C;` | top-level class/interface/enum | packages treated as external |
| Ruby/PHP | extension recognized | — | import extraction not implemented (contributions welcome) |

## What it resolves

- Relative imports → repo files (with extension probing + `index.*` barrels).
- tsconfig/jsconfig `paths` aliases (e.g. `@/*` → `src/*`).
- Python absolute + explicit-relative imports → repo files.
- Everything else (npm packages, stdlib, module paths) → marked **external**, never fabricated.

## Known limits (read before trusting output)

1. **No type information.** It sees `import { x } from './y'` but not whether `x` is a type,
   value, or re-export chain — barrel files create edges to the barrel, not through it.
2. **Dynamic patterns.** `require(variable)`, `import(pathExpr)` with non-literal paths are
   not resolved. Framework magic (dependency injection, decorators registering routes)
   is invisible to it.
3. **Monorepo cross-package imports** via workspace aliases need `paths` config to resolve.
4. **Risk scores are heuristics** (fan-in thresholds), not measurements. Treat `[CRITICAL]`
   as "look here first," not a verdict.
5. **Cycles** are import-graph cycles; some are intentional (type-only cycles in TS).

## Upgrade path

If a repo outgrows this scanner, the honest next step is tree-sitter WASM grammars per
language, keeping the same graph JSON contract (`.codequest/graph.json`) so every prompt,
skill, MCP tool, and CI check keeps working unchanged. The contract is the moat; the parser
is swappable.
