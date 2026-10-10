# CodeQuest — drop-in repo intelligence for GitHub Copilot

Copy this folder into any repository. It turns GitHub Copilot (agent mode) into **CodeQuest Core AI**:
a repo-comprehension engine that maps codebases, computes blast radius, narrates execution flows,
and simulates breaking changes — grounded in deterministic static analysis, not guesses.

## 60-second quickstart

```bash
# 1. Drop this folder into your repo (or clone CodeQuest and copy ./codequest)
cp -r codequest /path/to/your-repo/

# 2. Scan the repo — zero dependencies, runs offline (Node 18+)
cd /path/to/your-repo && ./codequest/bin/codequest scan

# 3. Open the repo in VS Code, start Copilot agent mode, and run:
#    /codequest-onboard
```

That's it. Copilot reads `CODEQUEST.md` + `.codequest/graph.json` and becomes the CodeQuest AI.

## What's inside

| Path | What it is |
|---|---|
| `CODEQUEST.md` | The master system prompt — the brain. |
| `.github/muse-instructions.md` | Auto-loaded repo instructions for Copilot. |
| `.github/instructions/` | Path-scoped analysis + formatting rules. |
| `.github/prompts/` | One-shot slash prompts: `/codequest-onboard`, `/codequest-map`, `/codequest-blast-radius`, `/codequest-story`, `/codequest-whatif`, `/codequest-review`. |
| `skills/` | Agent Skills (`repo-cartographer`, `blast-radius`, `story-mode`, `what-if`) for Copilot agent mode. |
| `bin/codequest` | Deterministic static analyzer (Node, zero deps). Builds the module graph Copilot reasons over. |
| `templates/` | Report templates: blast-radius, story-mode, module-card, architecture-overview. |
| `AGENTS.md` | Agent operating notes (also read by Copilot). |

## The loop

```
./codequest/bin/codequest scan        # deterministic: modules, imports, graph, risk
        │
        ▼
Copilot agent mode (/codequest-*)     # intelligence: summaries, narratives, judgment
        │
        ▼
.codequest/ + Markdown reports        # saved in-repo: works offline, diffable, reviewable
```

## Commands

```bash
./codequest/bin/codequest scan [dir]            # build .codequest/graph.json + repo-map.md
./codequest/bin/codequest map [dir]             # print the repo map
./codequest/bin/codequest blast-radius <file>   # impact matrix for a module
./codequest/bin/codequest story <entry-file>    # static execution trace from an entry point
./codequest/bin/codequest modules [dir]         # list modules + exports
```

Add `--json` to any command for machine-readable output.

## Requirements

- Node.js 18+ (analyzer only; no npm install needed — zero dependencies)
- VS Code + GitHub Copilot (agent mode) for the intelligence layer

## Privacy

The analyzer never touches the network. Everything it produces lives in `.codequest/`
inside your repo. Copilot interactions stay inside your existing Copilot session —
no new services, no code exfiltration beyond what you already trust Copilot with.
