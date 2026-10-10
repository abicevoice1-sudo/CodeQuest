---
name: what-if
description: Simulate a breaking change (rename, signature change, deleted export) and list everything that breaks, grouped by kind, with a migration sketch and test plan. Use before refactoring public APIs, shared utilities, or data models.
---

# what-if

Rehearse the breaking change before making it.

## Workflow

1. **Locate.** Find the symbol definition (`file:line`). Get its dependent set via
   `./codequest/bin/codequest blast-radius <file>`.
2. **Search.** Find every reference in the repo: imports, call sites, type/interface usages,
   re-exports, tests, docs. Record each as `file:line` + 1–2 surrounding lines.
3. **Group.** Breakages by kind: direct calls · type usages · re-exports · tests · docs.
4. **Plan.** Migration sketch (new signature + exact edit per group) and test plan
   (suites to re-run + the new test to add). Fill `codequest/templates/what-if.md`.

## Rules

- A reference search is not complete until you've covered imports, calls, types, and tests.
- Distinguish "breaks at compile/lint time" from "breaks silently at runtime" — the second
   kind is the one that pages people.
- End with a verdict: safe rename / coordinated change / don't touch without a plan.

## Tooling

Prefer the `codequest_*` MCP tools when the CodeQuest MCP server is configured; fall back to `./codequest/bin/codequest` CLI otherwise. If the team has wired company APIs as MCP servers, use them where relevant and say which one informed the answer.

## Audience

Read `.codequest/config.json` first. Adapt depth and vocabulary per CODEQUEST.md: beginner (explain jargon, more context), professional (default, dense), expert (terse, trade-offs first), businessLens (no code unless asked — business impact, cost, risk, recommended decision).
