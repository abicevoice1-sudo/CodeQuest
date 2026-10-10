<div align="center">

# Aperio

**Uncover any codebase.** *Aperio* is Latin for "to uncover, reveal" — point it at any repository and get a living map of how the code fits together, plain-language explanations of every part, and a shareable report you can walk through with anyone, technical or not.

Drop-in repo intelligence: module graphs, blast-radius analysis, and business-lens explanations — wired to any AI assistant via MCP. Your code never leaves your machine.

[![CI](https://github.com/abicevoice1-sudo/Aperio/actions/workflows/aperio.yml/badge.svg)](https://github.com/abicevoice1-sudo/Aperio/actions/workflows/aperio.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/aperio.svg)](https://www.npmjs.com/package/aperio)

*The visualizer: every module, every import, risk-scored — click any node to inspect it.*

</div>

## The 10-second version

Have Node 18+? One command, in your repo's folder:

```bash
npx aperio start
```

That's it. It copies the Aperio pack into your repo, configures your IDE (VS Code, Cursor, Windsurf, Zed), scans your code, and opens the interactive graph in your browser at `http://127.0.0.1:1337`.

No Node yet? One command installs everything:

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/abicevoice1-sudo/Aperio/main/install.sh | bash

# Windows (PowerShell)
iwr -useb https://raw.githubusercontent.com/abicevoice1-sudo/Aperio/main/install.ps1 | iex
```

## Show anyone what a codebase does

Aperio's killer feature: **explain any repo to any audience.** Pick a lens — Non-technical, Beginner, Junior, Senior, Lead — and every file, connection, table, and column is explained at exactly that level. Walk a business stakeholder through the App Guide on a call: what the app is, its departments, why each connection matters — all in plain language.

## Commands

```bash
aperio scan [dir]        # build .aperio/graph.json + repo map
aperio start [dir]       # the easy one: pack + IDE setup + scan + open graph
aperio visualize [dir]   # scan + open the interactive graph
aperio export -o report.html  # one self-contained HTML file, no server needed
aperio blast-radius <file>    # what breaks if you change this file
aperio diff <old> <new>  # architecture drift between snapshots
```

## For AI assistants

Aperio ships an MCP server, Copilot instructions, and prompt packs (`.github/`, `skills/`, `templates/`) so your AI assistant reasons about your actual codebase — not guesses. Run `aperio setup` to wire up your IDE.

## From CodeQuest?

Aperio was previously **CodeQuest** (`codequest-ai` on npm). Same engine, new name — `codequest-ai` is deprecated in favor of `aperio`. Your old `.codequest/` caches are picked up automatically.

## License

MIT — see [LICENSE](LICENSE).
