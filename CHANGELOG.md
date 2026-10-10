# Changelog

## 1.1.0 — 2026-10-09

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
