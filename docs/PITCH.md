# CodeQuest — Silicon Valley Startup Pitch & Product Strategy Memo

## Executive overview

- **Company:** CodeQuest Inc.
- **Tagline:** *Explore any codebase like an adventure. Visual navigation, zero-latency impact maps, and offline execution graphs.*
- **Category:** Developer Tools / AI Knowledge Graph & Code Comprehension Platform
- **ICP:** Enterprise engineering teams, open-source maintainers, technical product managers, onboarding software engineers.

## The problem

Every engineering team pays the same hidden tax: nobody knows how the codebase *actually*
fits together. Onboarding takes weeks. Refactors break distant features. "Who depends on this?"
is answered by grep, hope, and tribal knowledge.

## The product

A drop-in folder that turns GitHub Copilot into **CodeQuest Core AI** — a repo-comprehension
engine with three superpowers:

1. **Deterministic module graph** — `bin/codequest` statically maps every module, import edge,
   and entry point. Zero dependencies, fully offline. The AI reasons over facts, not guesses.
2. **Copilot-native intelligence** — slash prompts (`/codequest-onboard`, `/codequest-map`,
   `/codequest-blast-radius`, `/codequest-story`, `/codequest-whatif`, `/codequest-review`)
   and Agent Skills that generate onboarding tours, architecture maps, blast-radius reports,
   execution walkthroughs, and breaking-change simulations — all saved as Markdown in-repo.
3. **Trust through receipts** — every claim carries a `file:line` citation. Risk is scored
   (`[CRITICAL]` → `[LOW]`), never vibes.

## Why now / why we win

| Incumbent approach | CodeQuest advantage |
|---|---|
| SaaS code-graph tools (upload your repo to our cloud) | 100% local. The analyzer never touches the network; artifacts live in your repo. Enterprise-safe by construction. |
| Generic AI chat over code | Deterministic grounding layer — the AI can't hallucinate dependencies because the graph is computed, not guessed. |
| Wiki docs that rot | Living docs generated from the current graph, re-runnable on every refactor. |
| Weeks of onboarding | `/codequest-onboard`: the 60-second version, the start-here guide, and the danger zones. |

## Go-to-market

| Vector | Strategy |
|---|---|
| Product-led growth | Free drop-in folder; works with the Copilot subscription teams already pay for. Zero new procurement. |
| Open source | MIT-licensed pack; example outputs and sample apps included. Maintainers get `/codequest-review` for PRs. |
| Enterprise privacy tier | No data egress, ever. Analysis runs on the developer's machine inside their existing Copilot session. |
| Community | Onboarding stories and architecture maps are shareable artifacts — every output markets the tool. |

## Business model

- **Free:** the full drop-in pack (this repo).
- **Team:** shared `.codequest/` conventions, CI check that fails on untested `[CRITICAL]` changes, Slack digest of architecture drift.
- **Enterprise:** SSO-audited prompt packs, custom risk policies, monorepo-scale graph sharding.

## The one-line pitch

**CodeQuest turns "I don't know what this breaks" into a computed answer — inside the editor
your team already uses, without your code ever leaving the building.**
