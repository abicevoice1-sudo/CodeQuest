#!/usr/bin/env node
/**
 * CodeQuest MCP server — exposes bin/codequest as Model Context Protocol tools.
 *
 * Zero dependencies. Node 18+. Stdio transport (newline-delimited JSON-RPC).
 * Lets GitHub Copilot agent mode (or any MCP client) call the deterministic
 * analyzer as native tools instead of shelling out.
 *
 * Wire-up (VS Code): copy codequest/mcp.example.json to your repo's
 * .vscode/mcp.json. Add your company's own API MCP servers alongside it —
 * the agent can then mix CodeQuest's repo graph with any API you plug in.
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const BIN = path.join(__dirname, 'bin', 'codequest');
const SERVER = { name: 'codequest', version: '1.0.0' };

const TOOLS = [
  {
    name: 'codequest_scan',
    description: 'Scan a repo directory and build the deterministic module graph (.codequest/graph.json + repo-map.md). Run first, or re-run after large refactors.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string', description: 'Repo root (default: workspace root)' } } },
    argv: (a) => ['scan', a.dir || '.'],
  },
  {
    name: 'codequest_map',
    description: 'Get the full repo map: modules, layers, entry points, central modules, risk table.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string' } } },
    argv: (a) => ['map', a.dir || '.'],
  },
  {
    name: 'codequest_modules',
    description: 'List all modules with language, layer, exports, fan-in/fan-out, and risk.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string' } } },
    argv: (a) => ['modules', a.dir || '.'],
  },
  {
    name: 'codequest_blast_radius',
    description: 'Compute the blast radius of a module: upstream imports, 1st/2nd/3rd-degree downstream dependents, risk score, affected tests. Ground truth for impact questions.',
    inputSchema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', description: 'Module path (partial match ok, e.g. "logger.js")' },
        dir: { type: 'string' },
      },
    },
    argv: (a) => ['blast-radius', a.file, a.dir || '.'],
  },
  {
    name: 'codequest_story',
    description: 'Generate a static dependency trace (story mode) from an entry point: chronological file-by-file hops with file:line refs.',
    inputSchema: {
      type: 'object',
      required: ['entry'],
      properties: {
        entry: { type: 'string', description: 'Entry file (partial match ok, e.g. "index.js")' },
        dir: { type: 'string' },
      },
    },
    argv: (a) => ['story', a.entry, a.dir || '.'],
  },
];

function runTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`unknown tool: ${name}`);
  try {
    const out = execFileSync(process.execPath, [BIN, ...tool.argv(args || {}), '--json'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    return out;
  } catch (e) {
    const stderr = e.stderr ? String(e.stderr) : '';
    throw new Error(`codequest failed: ${stderr || e.message}`.trim());
  }
}

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function respondError(id, code, message) {
  const payload = { jsonrpc: '2.0', error: { code, message } };
  if (id !== undefined) payload.id = id;
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function handle(msg) {
  const { id, method, params } = msg;
  // Notifications have no id → no response.
  try {
    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: SERVER,
        });
        break;
      case 'ping':
        respond(id, {});
        break;
      case 'tools/list':
        respond(id, {
          tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        });
        break;
      case 'tools/call': {
        const text = runTool(params && params.name, params && params.arguments);
        respond(id, { content: [{ type: 'text', text }] });
        break;
      }
      default:
        if (id !== undefined) respondError(id, -32601, `method not found: ${method}`);
    }
  } catch (e) {
    if (id !== undefined) respondError(id, -32603, e.message);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  handle(msg);
});
