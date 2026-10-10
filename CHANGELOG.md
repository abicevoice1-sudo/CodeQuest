# Changelog

## 1.14.3 — 2026-10-10
- Business-person polish pass: Architecture tab now speaks in departments (Front Doors, What Customers See, The Work) with fixture/test files hidden and duplicate departments merged; Why-it-matters shows only real business connections with specific, non-repetitive explanations (verb-aware: scanning, exporting, commanding); fixed a crash when opening Architecture.

## 1.14.2 — 2026-10-10
- Business flow tab rewritten for non-technical: the confusing layer-count pairs ("UI Component → 11 Service") are gone, replaced with plain-language "what this app is", "parts of the business" cards, and a follow-one-request journey. File action buttons (Listen/Diagram/Blast) now show their text labels on mobile — no more mystery icons.

## 1.14.1 — 2026-10-10
- Removed the duplicated proficiency picker from Settings (it lives in the topbar only now).

## 1.14.0 — 2026-10-10
- Columns now explain themselves: every table column gets a "why it exists / what it does" line, proficiency-aware like file narration (business terms for non-technical, terse for seniors).
- Settings unified: one ⚙ panel now holds Experience (proficiency picker), Appearance (5 themes), and AI explain — no more scattered controls.
- 5 themes: Dark, Light, VS Code Dark+, Monokai, Dracula — full CSS-variable theming across the app, graph, and guide.
- Mobile homepage rebuilt: graph defaults to ⭐ Key files only (entries + highly-connected + hot) on small screens — 27 readable nodes instead of 180-node spaghetti. Minimap hidden on mobile. Desktop unchanged.

## 1.13.0 — 2026-10-10
- Run tab v2: README-first — commands are pulled from the README's own instructions (marked "from README"), with Python venv flow (venv → activate → pip install → run) and monorepo subdir support. Port detection now weights entry files and ignores example/fixture dirs.
- New 🏛 Architecture tab: layer map with dependency arrows, entry points, and top files per layer.
- Database: "Import from real database" — permission-gated .env scan with fuzzy matching across every variable name (masked previews only), plus live schema introspection for PostgreSQL/MySQL/MongoDB/SQLite via the local server.
- AI settings: "Import key from .env" with the same permission-gated fuzzy scan.
- Graph filters rebuilt: collapsible panel with presets (Code only, Hotspots, Show all), layer counts, and an active-filter badge.
- File explorer restyled: monogram type badges, indent guides, and clean folder glyphs.

## 1.12.0 — 2026-10-10
- App guide (📖 Guide): a full repo briefing — how to run it (commands, port, README quickstart), the standard app flow, database engines + tables/columns (Prisma, SQL, Mongoose, SQLAlchemy, Django), and why the top connections exist. Proficiency is now a 5-level ladder: Non-technical, Beginner, Junior / Senior / Lead Developer. Non-technical readers get a true business lens: the guide becomes a business flow, and every file explains what the business needs it for and what customers feel if it breaks.

## 1.11.0 — 2026-10-10
- Mobile UI repaired, verified with real headless-browser screenshots: the header no longer overlaps (stats move off the small screen), the About/Code tab switcher actually appears (a CSS specificity bug had kept it invisible), the explorer yields the full screen when a file is open, and the top bar wraps cleanly. File actions now have text labels (Listen / Diagram / Blast) on desktop.

## 1.10.0 — 2026-10-10
- The auto-playing tour is gone. First open now asks your technical level (not technical / developer / expert) and every explanation — including the 🔊 narration — adapts: plain language, standard terms, or terse expert. Switch anytime in the header.
- **Scoped diagrams**: the graph now zooms — file diagram (one file + its connections), folder diagram (◈ button on any folder in the explorer), whole-repo diagram — with a breadcrumb bar and explicit "Folder / Repo" zoom-out buttons.
- The command palette is now a command bar: type "diagram" or "architecture" and it offers diagram actions for the current file, its folder, or the whole repo, plus blast radius.

## 1.9.0 — 2026-10-10
- The file view is redesigned: breadcrumb header with badges, a "What it does / If you change it" summary card, stat cards, a proper blast-radius button, clean import lists, and a code pane with its own header (filename, language, line count, copy button) that fills the column. On phones the file view switches to About/Code tabs.
- New **command palette** (⌘K / Ctrl+K): fuzzy file search, symbol (export) search, and full code-content search with line snippets that jump straight to the matching line — plus recent files and full keyboard navigation.

## 1.8.0 — 2026-10-10
- The visualizer is now a VS Code-style IDE: a file explorer tree on the left (folders, language icons, risk dots, entry markers, filter), and clicking any file opens a split view — file info on the left, code on the right. Graph filters moved into a collapsible section. Layout stacks cleanly on phones.

## 1.7.0 — 2026-10-10
- The app now explains itself: a welcome overlay ("This is a map of your codebase") and a **guided tour** — press play and it flies you through the 5 most important files, speaking each one's purpose and impact.
- The side panel now answers "What am I looking at?" in plain sentences: file counts, the most connected file, circular imports, critical risks.

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
