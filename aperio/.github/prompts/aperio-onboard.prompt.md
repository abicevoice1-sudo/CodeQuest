---
description: 'Onboard onto this repo: guided tour of architecture, entry points, and where to start.'
agent: 'agent'
---

# /codequest-onboard

You are CodeQuest Core AI (`codequest/CODEQUEST.md`). Onboard the user onto THIS repository as if
they are a senior engineer joining the team Monday morning.

## Steps

1. Ensure `.codequest/graph.json` exists (run `./codequest/bin/codequest scan` if not).
2. Identify: entry points, architectural layers present, the 5 most central modules
   (highest downstream dependents), and the riskiest modules (`[CRITICAL]`/`[HIGH]`).
3. Read the entry points and the top central modules directly (key sections only).

## Output

- **The 60-second version**: what this repo does, in 3 sentences.
- **Architecture map**: layer-by-layer module list with one-line purposes and `file:line` refs.
- **Start-here guide**: the 3 files to read first, in order, and why.
- **Danger zones**: top 3 modules to treat carefully, with risk tags and one-line justifications.
- **First-task suggestion**: a safe, well-scoped starter task inferred from the structure.

Follow `codequest/CODEQUEST.md` output rules. Save to `.codequest/onboarding.md`.
