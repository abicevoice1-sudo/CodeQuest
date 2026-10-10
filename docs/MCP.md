# Wiring any API into CodeQuest (MCP)

CodeQuest's intelligence layer runs in GitHub Copilot agent mode, which speaks
**Model Context Protocol (MCP)**. Any API you can wrap in an MCP server becomes a tool
the CodeQuest agent can call — next to its own repo-graph tools.

## The bundled server: CodeQuest's own tools

`codequest/mcp-server.js` is a zero-dependency MCP server (stdio) exposing the analyzer:

| Tool | What it returns |
|---|---|
| `codequest_scan` | scans the repo, rebuilds `.codequest/graph.json` |
| `codequest_map` | full repo map (modules, layers, entry points, risk table) |
| `codequest_modules` | module list with exports, fan-in/fan-out, risk |
| `codequest_blast_radius` | upstream + downstream by degree, risk, affected tests |
| `codequest_story` | static dependency trace from an entry point |

**Setup:** copy `codequest/mcp.example.json` → your repo's `.vscode/mcp.json`.
VS Code discovers it on next reload; Copilot agent mode lists the five tools automatically.
Prefer these over shelling out to `bin/codequest` when they're available.

## Adding YOUR company's APIs

Any MCP server works. Examples teams commonly wire up:

- Ticketing (Jira, Linear): link a `[CRITICAL RISK]` module to its open incidents.
- Internal docs/runbooks: attach the owning team's runbook to a story trace.
- Internal code search: extend blast radius beyond one repo (monorepo/service graph).
- CI/CD: check whether the affected tests actually pass on main.

Add them as siblings in the same `mcp.json`:

```json
{
  "servers": {
    "codequest": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/codequest/mcp-server.js"]
    },
    "jira": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/tools/mcp-jira.js"],
      "env": { "JIRA_TOKEN": "${input:jira_token}" }
    }
  }
}
```

The CodeQuest agent (`codequest/.github/agents/codequest.agent.md`) and skills are already
instructed to use available MCP tools and to say which one informed an answer.

## Notes & limits

- **Model choice** is your Copilot admin's setting (GPT / Claude / Gemini) — the pack is
  model-agnostic Markdown and works with any of them.
- **Enterprise policy:** some companies disable MCP servers in VS Code. If yours does, the
  pack still works fully via the `bin/codequest` CLI fallback — you lose only the
  native-tool convenience, not the capability.
- **Secrets:** MCP `env` values stay in your local `mcp.json` (gitignore it if it holds
  tokens). The analyzer itself never needs any secret.
