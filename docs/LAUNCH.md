# CodeQuest launch kit

## What ships today

- **Copilot pack** (`codequest/`) — drop-in folder, 6 prompts, 4 skills, MCP server (8 tools), CI drift gate
- **Analyzer** — `regex` engine (zero-dep) + optional `tree-sitter` engine, 8 languages + asset inventory
- **Visualizer** (`visualizer/`) — dark dependency-graph UI: dagre layout, blast-radius heatmap, node inspector, search/filters
- **VS Code extension** (`extensions/vscode/codequest-1.1.0.vsix`) — sidebar graph, click-to-file
- **Docs** — README, PITCH, PARSER, MCP, ADOPTION, IDE_SUPPORT, ROADMAP, CHANGELOG

## Demo script (2 minutes)

1. `git clone` any repo → drop in `codequest/` → run `/codequest-onboard` (15s)
2. Show the generated repo map: layers, risk, entries (30s)
3. `/codequest-blast-radius` on a real file → heatmap in the visualizer (30s)
4. Open a PR → CI drift gate blocks a new circular import (30s)
5. `codequest story` → narrated walkthrough of a feature (15s)

Record with the **visualizer** on screen — it's the visual hook.

## Launch checklist

- [ ] Publish VS Code extension to Marketplace (`npx vsce publish`)
- [ ] Record the 2-minute demo (visualizer + terminal side by side)
- [ ] Screenshots: graph view, blast radius, node inspector, CI gate comment
- [ ] Post: Hacker News (Show HN), r/programming, r/vscode, dev.to
- [ ] Docs site (Docusaurus/Mintlify) from `docs/`
- [ ] 5 design-partner teams → run `docs/ADOPTION.md` 2-week trial

## Show HN draft

**Title:** Show HN: CodeQuest — drop-in folder that turns Copilot into a repo-intelligence AI

**Body:**
Every repo has the same problem: the architecture lives in one senior's head. CodeQuest is a
drop-in `codequest/` folder — 6 slash prompts, 4 agent skills, an MCP server, and a zero-dependency
analyzer that maps your modules, scores risk, traces blast radius, and gates PRs on architecture
drift. Plus a dark dependency-graph visualizer and a VS Code extension.

`./codequest/bin/codequest scan` → 250 modules mapped in 0.23s. No build step, no cloud, no
account. MIT licensed.

Try it: [repo URL] — would love brutal feedback on what breaks in your repo.

## Positioning (one-liner)

"Onboarding docs that never go stale — generated from your code, enforced by CI."
