---
name: blast-radius
description: Compute the blast radius of changing a file or symbol: upstream imports, downstream dependents by degree, risk score, and affected tests. Use before editing shared modules, reviewing PRs, or answering "what breaks if I change X".
---

# blast-radius

Impact analysis for a proposed change, computed — not guessed.

## Workflow

1. **Ground.** Run `./codequest/bin/codequest blast-radius <file> [--json]`. Its edge lists
   are the source of truth for the dependency structure.
2. **Read the target.** Enumerate its exports and what each export is for (read the file;
   quote the 3–10 lines that matter).
3. **Verify downstream.** Spot-check 1st-degree dependents by reading the importing lines.
   For `[CRITICAL]` candidates, verify 2nd degree as well.
4. **Score risk.** `[CRITICAL]` = wide downstream (8+ dependents) or central + untested.
   `[HIGH]` = 4+ dependents. `[MEDIUM]` = 1–3. `[LOW]` = leaf. Justify in one line.
5. **Report.** Fill `codequest/templates/blast-radius.md`.

## Rules

- Upstream = what the target imports (with `file:line`). Downstream = what imports the target.
- A risk claim without a downstream count is not a risk claim.
- End with a one-line verdict: ship it / ship with tests / stop and refactor first.

## Tooling

Prefer the `codequest_*` MCP tools when the CodeQuest MCP server is configured; fall back to `./codequest/bin/codequest` CLI otherwise. If the team has wired company APIs as MCP servers, use them where relevant and say which one informed the answer.
