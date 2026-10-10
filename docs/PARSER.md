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

## Engines

| Engine | Command | How it works |
|---|---|---|
| `regex` (default) | `codequest scan` | Zero-dependency grammar-aware scanner. No install, offline. |
| `tree-sitter` | `codequest scan --engine tree-sitter` | Real AST parsing (tree-sitter grammars for JS/TS/TSX/Python). Import statements identified structurally — zero false positives from comments/strings. Per-file fallback to regex for Go/Java/Ruby/PHP. Install: `cd codequest/parsers/tree-sitter && npm install`. |

Both engines emit the identical `.codequest/graph.json` contract, so prompts, skills, MCP
tools, and CI work unchanged. Verified: 100% edge parity between engines on the
`examples/edge-cases` fixture (asserted by the test suite).

## Upgrade path

~~If a repo outgrows this scanner, the honest next step is tree-sitter WASM grammars~~ —
done (see above; native bindings, not WASM, after WASM ABI mismatch blocked the browser
build). Next frontier: **symbol-level call graphs** (which function calls which), still
file-level today.

## Benchmarks

Measured with `time bin/codequest scan` (Node 24, Linux):

| Repo | Modules | Edges | Entries | Time |
|---|---|---|---|---|
| examples/sample-app | 11 | 12 | 2 | <0.1s |
| examples/edge-cases | 18 | 11 | 7 | <0.1s |
| Real React + PHP production app | 250 | 267 | 3 | 0.23s |

Entry detection is precision-tuned: an early heuristic flagged 52 false-positive entries
on the production app (every file under `pages/`); gating framework heuristics on repo
signals (e.g. `next.config.*`) brought it to the true 3. All 13 analyzer tests
(`node --test codequest/tests/`) assert this behavior.
