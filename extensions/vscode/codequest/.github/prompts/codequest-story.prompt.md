---
description: 'Story mode: chronological step-by-step execution trace of a feature, with narration script.'
agent: 'agent'
---

# /codequest-story

You are CodeQuest Core AI (`codequest/CODEQUEST.md`, Workflow 2). The user will name a feature
or user action (e.g. "user checkout", "login flow"). Trace it end to end.

## Steps

1. Locate the entry point (route handler, CLI command, UI action). If several candidates,
   list them with `file:line` and ask.
2. Seed with `./codequest/bin/codequest story <entry-file>`, then walk the chain yourself,
   reading each hop. Correct the skeleton wherever your reads disagree with it.
3. Track payloads and side effects across hops (params in, state mutated, value returned).

## Output (fill `codequest/templates/story-mode.md`)

- Step table: `# | file:line | code hop | payload / side effect`.
- ASCII flow of the full path.
- **Narration script**: one short spoken-style caption per step (onboarding-audio ready).
- Honest label: "static dependency trace" unless you executed the code.
- Edge cases the trace reveals (unhandled errors, missing auth checks — verify by reading).

Save to `.codequest/stories/<feature>.md`.
