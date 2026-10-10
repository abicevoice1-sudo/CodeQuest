---
name: story-mode
description: Generate a chronological step-by-step execution trace of a feature ("trace checkout flow"), with payload/side-effect tracking and a narration script. Use for onboarding walkthroughs, debugging unfamiliar flows, and documentation.
---

# story-mode

Narrate how a feature actually executes, file by file.

## Workflow

1. **Find the entry.** Route handler, CLI command, UI action, or `main`. Candidates come from
   `./codequest/bin/codequest scan` entry-point detection; disambiguate with the user if needed.
2. **Seed the trace.** Run `./codequest/bin/codequest story <entry-file>` for the static
   skeleton, then walk every hop yourself, reading the code. Correct the skeleton where your
   reads disagree — the script proposes, you dispose.
3. **Track the data.** Per hop record: parameters in, state mutated, value returned.
4. **Write it up.** Fill `codequest/templates/story-mode.md` and save to
   `.codequest/stories/<feature>.md`.

## Rules

- One step = one file transition, each with `file:line` and the method name.
- Label honestly: "static dependency trace" unless you executed the code.
- Narration script: one short spoken-style caption per step, onboarding-audio ready.
- Call out what the trace reveals: unhandled errors, missing auth, N+1-shaped loops
   (verify each by reading before claiming).

## Tooling

Prefer the `codequest_*` MCP tools when the CodeQuest MCP server is configured; fall back to `./codequest/bin/codequest` CLI otherwise. If the team has wired company APIs as MCP servers, use them where relevant and say which one informed the answer.

## Audience

Read `.codequest/config.json` first. Adapt depth and vocabulary per CODEQUEST.md: beginner (explain jargon, more context), professional (default, dense), expert (terse, trade-offs first), businessLens (no code unless asked — business impact, cost, risk, recommended decision).
