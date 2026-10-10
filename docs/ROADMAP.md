# CodeQuest — road to top-in-the-world

Where we are vs. world-class, dimension by dimension. Updated 2026-10-09 (v1.1.0).
Rule: every claim here must be closable with a concrete artifact.

## 1. Engine: from import graphs to semantic graphs

- **Now:** two engines — `regex` (zero-dep scanner) and `tree-sitter` (real ASTs for
  JS/TS/TSX/Python, 100% edge parity, per-file regex fallback); file-level import edges.
- **World-class:** **symbol-level call graphs** (which function calls which, with
  confidence), type-aware edges, cross-language edges (e.g. Python client → TS API route),
  incremental re-scan.
- **Next:** call-graph v1 on top of the tree-sitter engine; then publish precision/recall
  benchmarks.

## 2. Experience: from Markdown to the adventure

- **Now:** CLI + MCP + Markdown reports **+ visualizer** (`visualizer/`): dark interactive
  dependency graph (dagre layout, node inspector, blast-radius heatmap, search, layer/risk
  filters), reads any `.codequest/graph.json`.
- **World-class:** bidirectional code↔diagram sync, story-mode scrollytell, hosted demo.
- **Next:** code↔graph navigation in the extension (v1 ships click-to-file); story-mode
  animation; public demo instance.

## 3. IDE depth: from guest to resident

- **Now:** prompts, skills, custom agent, MCP server **+ VS Code extension v1**
  (`extensions/vscode/codequest-1.1.0.vsix`): graph sidebar, click-to-file, one-command
  rescan, engine setting.
- **World-class:** inline blast-radius codelens on save, "what breaks" hover, JetBrains/Cursor
  native ports.
- **Next:** codelens + hover (extension v2); publish to Marketplace; verify auto-load
  conventions per IDE on real installs.

## 4. Coverage: from 4 languages to the ecosystem

- **Now:** JS/TS/Python/Go/Java real; Ruby/PHP stubs.
- **World-class:** 20+ languages via tree-sitter **plus framework awareness**: React Router
  routes, Django/Flask URLs, Spring annotations → entry points; ORM models → data layer.
- **Next:** framework detectors (10 frameworks) before more languages — entry-point
  quality matters more than language count.

## 5. Scale: from sample apps to monorepos

- **Now:** verified on ~20 files. Untested at scale.
- **World-class:** benchmarked on a 500k-line monorepo; sub-second incremental scans;
  sharded graphs for cross-repo analysis.
- **Next:** publish a scale benchmark (repos × files × seconds) in `docs/PARSER.md`.

## 6. Trust: from honest limits to measured accuracy

- **Now:** limits documented (good — rare).
- **World-class:** measured precision/recall on edge fixtures, false-positive rates
  published, per-edge confidence scores.
- **Next:** `examples/edge-cases/` becomes a scored test suite; CI asserts on it.

## 7. Moat: from replicable to sticky

- **Now:** distribution wedge + workflow; drift gate is the first sticky-shaped feature.
- **World-class:** accumulated drift history teams won't abandon; org-level knowledge
  graph (cross-repo blast radius); team conventions encoded in the workflow.
- **Next:** drift history storage + cross-repo graph (Phase 3). Nothing to do before
  Phase 1–2 earn the right.

## 8. Traction: from zero to ten teams

- **Now:** 0 users.
- **World-class:** 10 design partners with metrics, public launch, contributors.
- **Next:** run `docs/ADOPTION.md` playbook. This is the only work that changes the
  investment rating. Everything above is table stakes for it.

## 9. Project maturity: dogfood everything

- **Now:** no tests for the analyzer, no CI on this repo, no changelog/releases.
- **World-class:** test suite, the drift gate running on this repo itself, releases,
  contributing guide. (We ship a CI template we don't use — fix that first; it's
  embarrassing and it's free.)
- **Next:** `codequest/ci/codequest.yml` live on this repo + analyzer test suite.

## Phasing

- **Phase 1 — credibility:** tests, dogfood CI, tree-sitter, call-graph v1, scale benchmark.
- **Phase 2 — wow:** visualizer web app, VS Code extension.
- **Phase 3 — moat:** drift history, cross-repo graphs, framework awareness.
- **Phase 4 — traction:** 10-team trials, public launch.

Phase 4 is the only one that changes the rating. Phases 1–3 earn the right to run it.
