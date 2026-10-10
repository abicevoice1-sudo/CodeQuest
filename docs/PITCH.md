# CodeQuest — pitch memo (v2)

**One-liner:** Drop-in repo intelligence for GitHub Copilot — a computed module graph,
blast-radius analysis, and story traces, wired to any API via MCP. Your code never leaves
your machine.

## The problem (in the buyer's words)

"Our onboarding takes six weeks. Every refactor breaks something nobody knew depended on it.
Our wiki architecture page is from 2023." — every eng manager, everywhere.

## The wedge

Teams already pay for GitHub Copilot. CodeQuest rides that seat: a folder dropped into the
repo turns Copilot into a repo-comprehension engine. **Zero procurement, zero new SaaS,
zero code exfiltration.** The security review is a one-liner: "it runs locally."

## The product (what's real today)

1. **Deterministic graph** — `bin/codequest` statically maps modules, imports, entry points,
   cycles, and risk. Zero deps, offline. Capabilities and limits documented in `docs/PARSER.md`.
2. **Copilot-native intelligence** — 6 slash prompts, 4 Agent Skills, 1 custom agent.
3. **MCP tools + any API** — the analyzer as native tools; the team plugs in Jira, runbooks,
   internal search alongside it.
4. **Drift gate for CI** — `codequest diff` fails PRs that add `[CRITICAL]`-risk modules or
   circular imports. This is the workflow that makes it sticky.

## The buyer and the ROI

- **Buyer:** the eng manager (owns onboarding cost + incident count).
- **Measured outcomes:** time-to-first-PR for new hires, PR review turnaround, "what breaks
  if I change X" questions asked in Slack, drift-gate catches per quarter.
- **Trial:** `docs/ADOPTION.md` — the two-week, one-team playbook that produces the numbers.

## Honest moat assessment

**Defensible today:** distribution (rides Copilot seats, no procurement), the `.codequest/`
living-docs convention + drift data teams accumulate, workflow stickiness once the CI gate
is on. **Not defensible:** the parser (replicable), the prompts (copyable), the MCP server
(open protocol — Microsoft could ship a native one). The durable advantage, if one emerges,
is the accumulated drift history + team workflow, not the code. We say this plainly because
investors will ask, and the honest answer is the strategy: win on workflow and data
accumulation, not on algorithms.

## Go-to-market

| Phase | Motion |
|---|---|
| 0–10 teams | Founder-led trials using `docs/ADOPTION.md`. Every trial produces a metrics page. |
| 10–100 | Open-source flywheel: teams share their architecture maps; every shared map markets the tool. |
| 100+ | Team tier: shared drift dashboards, cross-repo graphs, SSO-audited prompt packs. |

## Business model

- **Free:** the full pack (this repo), MIT.
- **Team:** drift history, cross-repo blast radius, Slack digests of architecture changes.
- **Enterprise:** custom risk policies, monorepo sharding, audit trails.

## The ask (when we're ready)

Design partners, not dollars: 10 teams, two weeks each, metrics out. The company gets built
on the trial data, not on this memo.
