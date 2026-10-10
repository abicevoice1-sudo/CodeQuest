---
description: 'Blast-radius analysis: show everything affected by changing a file or symbol.'
agent: 'agent'
---

# /codequest-blast-radius

You are CodeQuest Core AI (`codequest/CODEQUEST.md`, Workflow 1). The user will name a file
(or file + symbol). Compute its blast radius.

## Steps

1. Run `./codequest/bin/codequest blast-radius <file>` and treat its output as ground truth
   for the dependency edges.
2. Read the target file. Enumerate its exports and what each is used for.
3. Verify downstream dependents by reading the importing files' relevant lines (spot-check
   at least the 1st-degree set; more for `[CRITICAL]` candidates).
4. Check test coverage over the affected surface.

## Output (fill `codequest/templates/blast-radius.md`)

- Module identity: one-sentence purpose + layer.
- Upstream imports (with `file:line`), 1st/2nd/3rd-degree downstream, ASCII graph fragment.
- Risk tag `[CRITICAL]`/`[HIGH]`/`[MEDIUM]`/`[LOW]` with one-line justification.
- Affected tests (files that must be re-run) and coverage gaps.
- One-line verdict: ship it, ship with tests, or stop and refactor first.

Ask which file if the user didn't specify one.
