# IDE & AI assistant support

CodeQuest is **model-agnostic** (works with GPT, Claude, Gemini — whatever your assistant
offers) and **multi-IDE**. Run `./codequest/bin/codequest setup` in your repo: it detects
what's installed on your machine and writes each IDE's native configuration automatically.

## What `setup` detects

| IDE | Detected via | AI assistant detected |
|---|---|---|
| VS Code / Insiders | `code` binary or `~/Library/Application Support/Code`, `~/.config/Code` | GitHub Copilot (+Chat), Tabnine via extensions dir |
| Cursor | `cursor` binary or `~/.cursor` | Cursor AI (built-in) |
| Windsurf | `windsurf` binary or `~/.codeium` | Windsurf AI (built-in) |
| Zed | `zed` binary | Zed AI (built-in) |
| JetBrains (IntelliJ, PyCharm, WebStorm…) | JetBrains config dirs or toolbox binaries | via AGENTS.md (AI Assistant / Junie) |
| Neovim / Vim | `nvim` / `vim` binaries | via AGENTS.md (most AI plugins read it) |
| Sublime Text | `subl` binary | via AGENTS.md |
| Amazon Q | `q` binary | Amazon Q (CLI) |

## What `setup` writes (per detected IDE)

| IDE | Files |
|---|---|
| **All** | `AGENTS.md` at repo root — the universal bridge (read by Copilot, Cursor, Junie, Amp, Zed, …) |
| VS Code / Copilot | `.github/muse-instructions.md`, `.github/agents/`, `.github/prompts/`, `.github/instructions/`, `.vscode/mcp.json` |
| Cursor | `.cursor/rules/codequest.mdc` (always-apply rule), `.cursor/mcp.json` |
| Windsurf | `.windsurf/rules/codequest.md`, `.windsurf/mcp.json` |

Existing files are never overwritten. MCP configs are merged (the `codequest` server is
added alongside yours).

## Commands

```bash
./codequest/bin/codequest setup              # detect + configure (this machine)
./codequest/bin/codequest setup --dry-run     # preview only
./codequest/bin/codequest setup --all         # configure every supported IDE
./codequest/bin/codequest setup --ide cursor  # configure one IDE
```

A record lands in `.codequest/setup.json` (what was detected, what was written).

## Notes & limits

- **Enterprise policy:** some companies disable MCP servers or restrict extensions. `setup`
  still works — the pack falls back to the `bin/codequest` CLI everywhere.
- **Models:** model choice is your assistant/admin's setting. The pack is plain Markdown +
  deterministic tools; there is nothing model-specific to configure.
- **JetBrains/Neovim/Sublime:** no standard per-IDE agent-config location exists, so
  `AGENTS.md` at the repo root is the integration point (all major AI plugins read it).
