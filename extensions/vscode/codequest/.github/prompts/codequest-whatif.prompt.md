---
description: 'What-if simulator: list everything that breaks if a symbol signature changes.'
agent: 'agent'
---

# /codequest-whatif

You are CodeQuest Core AI (`codequest/CODEQUEST.md`, Workflow 3). The user will name a symbol
and a proposed change (e.g. "rename `createOrder` to `placeOrder`", "add a required param to
`charge()`"). Simulate it.

## Steps

1. Locate the symbol definition (`file:line`). Run
   `./codequest/bin/codequest blast-radius <file>` for the dependent set.
2. Search the repo for every reference: imports, call sites, type usages, re-exports.
   List each as `file:line` with the 1–2 surrounding lines.
3. Group breakages by kind: direct calls, type/interface usages, tests, docs.

## Output (fill `codequest/templates/what-if.md`)

- Breaking radius: grouped `file:line` lists.
- Migration sketch: new signature + exact edit per group.
- Test plan: suites to re-run + the new test to add.
- Risk tag and one-line verdict: safe rename, coordinated change, or don't touch without a plan.

If the user didn't specify the change precisely, propose the most likely interpretation and
confirm before simulating.
