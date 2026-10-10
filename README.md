# CodeQuest

**Explore any codebase like an adventure.** A drop-in folder that turns GitHub Copilot into
CodeQuest Core AI — a repo-comprehension engine for architecture maps, blast-radius analysis,
execution walkthroughs, and breaking-change simulations. Deterministic static analysis underneath,
Copilot intelligence on top, everything saved as Markdown in your repo. Fully offline.

## The 60-second version

```bash
# 1. Copy the drop-in folder into your repo
cp -r codequest /path/to/your-repo/

# 2. Scan it — zero dependencies, offline (Node 18+)
cd /path/to/your-repo && ./codequest/bin/codequest scan

# 3. In VS Code, open Copilot agent mode and run:
/codequest-onboard
```

Copilot reads `codequest/CODEQUEST.md` + the generated `.codequest/graph.json` and becomes the
CodeQuest AI: grounded in a computed module graph, incapable of hallucinating your dependencies.

## What's in the pack

```
codequest/
├── CODEQUEST.md              # the master system prompt — the brain
├── AGENTS.md                 # agent operating notes
├── README.md                 # drop-in quickstart
├── .github/
│   ├── muse-instructions.md# auto-loaded Copilot instructions
│   ├── instructions/         # analysis + formatting rules (always applied)
│   └── prompts/              # /codequest-onboard, -map, -blast-radius, -story, -whatif, -review
├── skills/                   # Agent Skills: repo-cartographer, blast-radius, story-mode, what-if
├── bin/codequest             # deterministic static analyzer (Node, zero deps, offline)
└── templates/                # report templates (blast-radius, story-mode, what-if, architecture, module-card)
```

## The loop

```
./codequest/bin/codequest scan        # deterministic: modules, imports, graph, risk scores
        │
        ▼
Copilot agent mode (/codequest-*)     # intelligence: summaries, narratives, judgment
        │
        ▼
.codequest/ + Markdown reports        # saved in-repo: offline, diffable, reviewable
```

## Analyzer commands

```bash
./codequest/bin/codequest scan [dir]            # build .codequest/graph.json + repo-map.md
./codequest/bin/codequest map [dir]             # print the repo map
./codequest/bin/codequest modules [dir]         # list modules + exports
./codequest/bin/codequest blast-radius <file>   # upstream, downstream by degree, risk, affected tests
./codequest/bin/codequest story <entry-file>    # static execution trace from an entry point
# add --json to any command for machine-readable output
```

## Try it

`examples/sample-app/` is a tiny JS/Python service with real import chains. Run the scan there
and see `examples/outputs/` for what the analyzer produces.

## Docs

- `codequest/CODEQUEST.md` — master system prompt (start here to understand the AI's contract)
- `codequest/README.md` — drop-in quickstart for any repo
- `docs/PITCH.md` — startup pitch & product strategy memo

## Privacy

The analyzer never touches the network. All artifacts live in `.codequest/` inside your repo.
The intelligence layer runs inside your existing Copilot session — no new services, no code
leaving your machine beyond what you already trust Copilot with.

## License

MIT — drop it into any repo, commercial or otherwise.
