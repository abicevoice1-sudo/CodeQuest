<div align="center">

# ⬢ CodeQuest

**Understand any codebase — no matter how technical you are.**

CodeQuest turns a repo into an interactive map: every file, every connection, every API endpoint — explained in plain language, linked to your Jira tickets and Figma designs. Business people finally see *why* the code exists. Developers see *what breaks* before they touch it.

[![CI](https://github.com/abicevoice1-sudo/CodeQuest/actions/workflows/codequest.yml/badge.svg)](https://github.com/abicevoice1-sudo/CodeQuest/actions/workflows/codequest.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/codequest-ai.svg)](https://www.npmjs.com/package/codequest-ai)

*Your code never leaves your machine. Zero dependencies. Fully offline.*

</div>

---

## The 10-second version

**One click** — no terminal, no install, no internet:

```
YourFolder/
  CodeQuest/      ← this repo
  project/        ← the code you want to understand
```

Double-click **`Analyze Project.bat`** (Windows) or run **`./analyze-project.sh`** (Mac/Linux) inside `CodeQuest/`. It starts the server and opens the interactive map in your browser.

**Or with npm:**

```bash
npx codequest-ai start
```

That's it. Scans your code, opens the graph at `http://127.0.0.1:1337`.

---

## What you get

### 🗺️ The map
Every file is a box. Lines show which files talk to which. Critical files glow — you *feel* what's important before reading a word. Large repos automatically show key files first (toggle "Show all" any time).

### 💼 Business view
Pick **Non-technical** and the whole product speaks plain language: *"This file handles customer login — without it, anyone could open anyone's account."* The Architecture tab shows departments, not directories. Made for showing on calls.

### 🔌 API explorer
Every endpoint in the codebase — method, path, what it's for, what files it touches. Auto-detected from Next.js, Express, and Fastify. One tap jumps from endpoint to implementation.

### 🎯 Blast radius
Click any file → **Blast** → see everything that breaks if you change it, by degree. The question every developer asks, answered instantly.

### 🔗 Share links
Copy a link to any view — a file, a blast radius, a proficiency level — and anyone opening it sees exactly what you see. Works in the exported HTML with no server.

### 📋 Jira bridge
Connect Jira in Settings. Ticket keys in code (`PROJ-123`) surface as cards: summary, status, priority, assignee. Business people see *why* a file exists.

### 🎨 Figma bridge
Attach Figma files in Settings. Designs appear next to the code — thumbnails, live previews, and frame-to-component matching (`SettingsModal.tsx` finds the "Settings modal" frame).

### 🔊 Voice
Listen to any explanation read aloud. Pick from your system's voices, tune speed and pitch. Navigate by voice: *"blast radius of auth."*

### 📄 One-file export
`codequest export -o report.html` → a single self-contained HTML file. Send it to anyone. Opens anywhere. No server, no install.

---

## Proficiency levels

Explanations adapt to who's reading:

| Level | You get |
|---|---|
| **Non-technical** | Business view — why it matters, what breaks for customers |
| **Beginner** | Plain language, no jargon |
| **Junior Developer** | Guided, terms explained |
| **Senior Developer** | Dense, mechanism-first |
| **Lead Developer** | Architecture and trade-offs |

---

## Commands

```bash
npx codequest-ai start              # scan + open the visualizer
npx codequest-ai visualize [dir]    # serve the visualizer for a repo
npx codequest-ai export [dir] -o report.html   # self-contained HTML, no server
npx codequest-ai scan [dir]         # print the module graph as JSON
```

---

## For AI coding assistants

CodeQuest ships as a drop-in pack for GitHub Copilot, Cursor, Windsurf, and Zed — module graphs, MCP server, and CI drift gates included. See [CODEQUEST.md](CODEQUEST.md) and [AGENTS.md](AGENTS.md).

## VS Code extension

In `extensions/vscode/` — open the visualizer without leaving your editor.

---

## License

MIT — see [LICENSE](LICENSE).
