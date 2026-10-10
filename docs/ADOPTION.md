# The 10-team trial playbook

CodeQuest earns its place the same way every beloved dev tool did: a team tries it for two
weeks and refuses to give it back. This is the exact playbook to run that trial — and the
data to collect, because "developers loved it" is not a metric.

## Week 0 — the wow meeting (30 min)

1. Drop the `codequest/` folder into the repo, run `./codequest/bin/codequest scan`.
2. In a team meeting, open Copilot agent mode and run `/codequest-onboard` live.
3. Ask the room: "What's wrong or missing?" Fix the map together — the team now co-owns it.
4. End with one assignment: everyone runs `/codequest-blast-radius` on the next file they
   touch before opening the PR.

**You know it's working when:** someone says "I didn't know that depended on this."

## Week 1 — measure the baseline

Track these for two weeks (a spreadsheet is fine):

| Metric | How to measure | Why it matters |
|---|---|---|
| Time-to-first-PR for new hires | ask the last 2 hires / estimate | onboarding cost, the buyer-visible number |
| "What breaks if I change X?" questions | count in Slack/PR comments | the exact pain CodeQuest kills |
| PR review turnaround | from your forge's API | blast-radius reports speed reviews |
| Onboarding doc freshness | date of last update | CodeQuest maps regenerate; wikis rot |

## Week 2 — turn on the drift gate

Copy `codequest/ci/codequest.yml` → `.github/workflows/codequest.yml`. It fails PRs that
introduce new `[CRITICAL]`-risk modules or circular imports.

**Count:** every failed check is a prevented incident review. Log them — this is your ROI.

## The report-back (what to send the skeptic)

After two weeks, one page:

- Before/after on the four metrics above.
- Quotes (2–3, named engineers, specific moments).
- Failed drift checks that caught real problems (the money slide).
- What the team still does manually (your roadmap).

## Rules of the trial

- One repo, one team, two weeks. Not three repos, not "the whole org."
- The eng manager must attend the wow meeting — they're the buyer.
- If the team won't run the drift gate, the trial failed: the value is in the workflow,
  not the demo.
