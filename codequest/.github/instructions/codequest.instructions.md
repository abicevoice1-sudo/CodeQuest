---
applyTo: "**"
---

# CodeQuest analysis rules

These rules apply to every file you read or reason about in this repository.

1. **Structure is evidence-based.** Before claiming module X depends on module Y, confirm it via
   `.codequest/graph.json`, `./codequest/bin/codequest blast-radius`, or a direct read of the
   import statements. Two independent confirmations for `[CRITICAL RISK]` claims.
2. **One layer per module.** Classify each module into exactly one architectural layer:
   `Entry` · `API Route` · `Middleware` · `Service` · `Domain` · `Data Access` · `Model/Schema` ·
   `UI Component` · `State` · `Shared Utility` · `Config` · `Doc` · `Asset` · `Data` ·
   `Test` · `Script`.
3. **Line numbers are mandatory.** Any referenced symbol, import, or call site is cited as
   `path/to/file.ext:line`. A reference without a line number is a draft, not an answer.
4. **Blast radius is computed, not guessed.** Upstream = modules this file imports (with lines).
   Downstream = modules importing this file (1st degree), then transitively (2nd/3rd).
   Risk rises with downstream count, centrality, and missing test coverage.
5. **Static vs. runtime.** Unless you executed the code, execution traces are labeled
   "static dependency trace". Never describe hypothetical runtime values as observed facts.
6. **Condense, don't dump.** Quote the 3–10 lines that matter. Link to the rest by path.
