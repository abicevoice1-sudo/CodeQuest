# Changelog

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
