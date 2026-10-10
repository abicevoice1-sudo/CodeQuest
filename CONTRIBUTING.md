# Contributing to CodeQuest

## The one rule

Every claim must be closable with a concrete artifact. Don't say "better parser" —
show the fixture, the test, and the benchmark.

## Setup

```bash
git clone https://github.com/abicevoice1-sudo/CodeQuest.git
cd CodeQuest
node --test codequest/tests/          # analyzer suite (19 tests, zero deps)
cd visualizer && npm install && npm run dev
```

## Where things live

- `codequest/bin/codequest` — CLI entry (thin; dispatches to `lib/`)
- `codequest/lib/` — `scan.js` (graph engine), `commands.js` (diff/blast/story/map),
  `setup.js` (IDE detection), `util.js`
- `codequest/parsers/tree-sitter/` — optional AST engine (`npm install` there)
- `visualizer/` — React graph UI (reads any `.codequest/graph.json`)
- `extensions/vscode/` — VS Code extension (`./build.sh` to package)
- `examples/edge-cases/` — analyzer fixtures; add one when you fix a parsing bug

## Pull requests

1. Add/extend a fixture in `examples/edge-cases/` for parser changes.
2. `node --test codequest/tests/` must stay green.
3. Update `CHANGELOG.md`.
4. This repo dogfoods its own drift gate — don't introduce new circular imports.

## Filing issues

Use the templates. Include: repo language mix, `scan` output stats, and what you
expected. Screenshots for visualizer issues.
