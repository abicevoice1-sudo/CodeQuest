# AGENTS.md — CodeQuest drop-in

## What this folder is

A drop-in repo-intelligence system. `CODEQUEST.md` is the master prompt; `bin/codequest`
is the deterministic analyzer; `.github/` wires both into GitHub Copilot.

## Rules for agents working in a repo that contains this folder

1. Read `CODEQUEST.md` first. It outranks generic habits for analysis tasks.
2. Run `./codequest/bin/codequest scan` before answering structural questions; re-scan after
   large refactors. Commit `.codequest/graph.json` when the team agrees (it's deterministic).
3. Slash prompts live in `.github/prompts/`; skills in `skills/`; report templates in `templates/`.
   Prefer them over inventing new formats.
4. Keep the analyzer zero-dependency (Node stdlib only). It must run offline on a fresh machine.
5. Never exfiltrate repo contents; all artifacts stay in-repo under `.codequest/` or `docs/`.
