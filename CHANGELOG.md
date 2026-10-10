# Changelog

## 1.6.0 — 2026-10-10
- New `export` command: `codequest export -o report.html` writes one self-contained HTML file — graph, source code, and UI all inlined. Double-click it, email it, host it anywhere. No server, no uploads, nothing to install for the viewer.
- The Code tab now prefers embedded sources, so exported reports show code offline.

## 1.5.0 — 2026-10-10
- Voice now **speaks a file's purpose and impact**: "explain this file" (or the 🔊 button) narrates what the module does, what it exposes, who imports it — and what would break if you change it. Deterministic, from the graph: no API key, no cost, always works.
- The AI ✨ Explain tab stays for the deep LLM dive.

## 1.4.0 — 2026-10-10
- Visual craft pass: nodes sized by importance (entry points + heavily-imported modules stand taller), risk glow on hot nodes, glowing risk bar, hover lift, smoother edges.
- Search 2.0: fuzzy matching with a results dropdown, keyboard navigation (↑↓/Enter/Esc), full-path subtitles.
- Large-repo guard: over 400 modules auto-hides tests & configs with a notice, so the graph stays readable.
- First-run coach tip; "Load another" hidden in server mode (the CLI is the front door now).
- Tests: 22/22 (analyzer), 19/19 (visualizer) green.

## 1.3.0 — 2026-10-10
- Visualizer is now a real code explorer: click any module → **Code** tab shows its source with syntax highlighting, served live from your repo.
- **AI file explanations**: ✨ Explain tab calls any OpenAI-compatible LLM with your own key (Settings ⚙, stored only in your browser).
- **Voice control** 🎙 (Chrome/Edge): "find login", "explain this file", "blast radius of auth" — spoken answers included.
- `visualize`/`start` server gained a traversal-safe `/api/file` endpoint.
- Tests: 22/22 (analyzer), 16/16 (visualizer) green.

## 1.2.1 — 2026-10-10
- Visualizer: proper page title ("CodeQuest — Repo Graph"); empty state leads with the `npx codequest-ai start` command instead of a bare file upload.

## 1.2.0 — 2026-10-10
- New `start` command: the super-easy one — copies the pack into your repo, sets up your IDE, scans, and opens the interactive graph in your browser. One command, everything.
- One-line setup: `npx codequest-ai start` (Node 18+), or `install.sh` / `install.ps1` one-liners that install Node + the package + launch.
- New `visualize` command: scans the repo, serves the visualizer locally, and opens it in your browser — one command, zero setup. Always on port 1337.
- The visualizer now ships inside the npm package and the drop-in folder.
- Test suite: 21/21 (analyzer) green.

## 1.1.1 — 2026-10-09

- **Repo presentation overhaul**: README hero with screenshots + badges, pack tree docs.
- **Analyzer split**: 1,065-line monolith → `bin/codequest` + `lib/` (`scan.js`, `commands.js`,
  `setup.js`, `util.js`); single `VERSION` source. All 19 tests still green.
- **Build hygiene**: `visualizer/dist`, extension `media/`, `.vsix`, and the bundled analyzer
  copy are git-ignored build outputs now; `extensions/vscode/build.sh` reproduces them.
- **Community**: `CONTRIBUTING.md`, issue templates, PR template.
- **Distribution-ready**: `codequest/package.json` (npm bin) — `npm publish` is one step away.
- **Visualizer tests**: 6 vitest tests for layout + blast-radius logic.

- **Tree-sitter engine** (`--engine tree-sitter`): real AST parsing for JS/TS/TSX/Python,
  zero false positives from comments/strings; 100% edge parity with the regex engine
  (asserted by tests). Optional: `cd codequest/parsers/tree-sitter && npm install`.
- **Drift history**: `codequest history` records snapshots, `codequest trends` shows them.
- **Asset inventory**: configs, docs, images, PDFs, data files appear in the repo map.
- **Audience modes**: `codequest init --audience beginner|professional|expert [--business]`.
- **Auto IDE setup**: `codequest setup` detects local IDEs/AI assistants and configures each.
- **MCP**: 8 tools (added `codequest_diff`, `codequest_history`, `codequest_trends`).
- **Tests**: 18 assertions, `node --test codequest/tests/`, all green.
- **Dogfooding**: this repo now runs its own drift gate in CI.

## 1.0.0 — 2026-10-09

- Initial Copilot pack: master prompt, 6 slash prompts, 4 Agent Skills, custom agent.
- Zero-dependency analyzer: scan/map/modules/blast-radius/story/diff.
- MCP server, report templates, sample apps, pitch memo. MIT licensed.
