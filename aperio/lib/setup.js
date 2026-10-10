'use strict';
/* Environment setup: detect IDEs/AI assistants, write their configs. */
const fs = require('fs');
const path = require('path');
const { out, fail } = require('./util');
const { VERSION } = require('./scan');
// ------------------------------------------------- environment setup ---

function detectEnvironment() {
  const os = require('os');
  const { execSync } = require('child_process');
  const platform = os.platform();
  const home = os.homedir();
  const ides = [], assistants = [], notes = [];
  const hasBin = (name) => {
    try {
      execSync(platform === 'win32' ? `where ${name}` : `command -v ${name}`, { stdio: 'pipe' });
      return true;
    } catch { return false; }
  };
  const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

  // VS Code (+ Copilot / Tabnine via extensions)
  const vscodeUser = platform === 'darwin' ? path.join(home, 'Library/Application Support/Code')
    : platform === 'win32' ? path.join(process.env.APPDATA || '', 'Code')
    : path.join(home, '.config/Code');
  if (hasBin('code') || exists(vscodeUser)) {
    ides.push({ id: 'vscode', name: 'VS Code' });
    try {
      const exts = fs.readdirSync(path.join(vscodeUser, 'extensions'));
      if (exts.some(e => e.startsWith('github.copilot'))) {
        assistants.push({ id: 'copilot', name: 'GitHub Copilot', via: 'VS Code' });
      }
      if (exts.some(e => e.toLowerCase().startsWith('tabnine'))) {
        assistants.push({ id: 'tabnine', name: 'Tabnine', via: 'VS Code' });
      }
    } catch { /* no extensions dir */ }
  }
  if (hasBin('code-insiders')) ides.push({ id: 'vscode-insiders', name: 'VS Code Insiders' });
  // Cursor (AI built in)
  if (hasBin('cursor') || exists(path.join(home, '.cursor'))) {
    ides.push({ id: 'cursor', name: 'Cursor' });
    assistants.push({ id: 'cursor-ai', name: 'Cursor AI', via: 'built-in' });
  }
  // Windsurf (AI built in)
  if (hasBin('windsurf') || exists(path.join(home, '.codeium'))) {
    ides.push({ id: 'windsurf', name: 'Windsurf' });
    assistants.push({ id: 'windsurf-ai', name: 'Windsurf AI', via: 'built-in' });
  }
  // Zed (AI built in)
  if (hasBin('zed')) {
    ides.push({ id: 'zed', name: 'Zed' });
    assistants.push({ id: 'zed-ai', name: 'Zed AI', via: 'built-in' });
  }
  // JetBrains (AI Assistant / Junie read AGENTS.md)
  const jb = platform === 'darwin'
    ? path.join(home, 'Library/Application Support/JetBrains')
    : path.join(home, '.config/JetBrains');
  if (exists(jb) || hasBin('idea') || hasBin('pycharm') || hasBin('webstorm')) {
    ides.push({ id: 'jetbrains', name: 'JetBrains IDEs' });
    notes.push('JetBrains: AGENTS.md is picked up by AI Assistant / Junie automatically.');
  }
  // Neovim / Vim (no standard config — AGENTS.md is the bridge)
  if (hasBin('nvim') || hasBin('vim')) {
    ides.push({ id: 'neovim', name: 'Neovim/Vim' });
    notes.push('Neovim/Vim: no standard agent-config location — AGENTS.md at repo root is read by most AI plugins.');
  }
  // Sublime
  if (hasBin('subl')) ides.push({ id: 'sublime', name: 'Sublime Text' });
  // Amazon Q CLI
  if (hasBin('q')) assistants.push({ id: 'amazon-q', name: 'Amazon Q', via: 'CLI' });

  if (!assistants.length) {
    notes.push('No AI assistant detected — the pack is model-agnostic and works with any you install later.');
  }
  notes.push('The pack works with every model your assistant offers (GPT, Claude, Gemini…) — no model-specific setup.');
  return { platform, ides, assistants, notes };
}

function copyMissing(src, dst) {
  // Copy a file or directory tree, never overwriting existing files. Returns files written.
  const written = [];
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src)) {
      written.push(...copyMissing(path.join(src, e), path.join(dst, e)));
    }
  } else if (!fs.existsSync(dst)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    written.push(path.relative(process.cwd(), dst));
  }
  return written;
}

function mergeMcpJson(dst, packExample) {
  const server = {
    type: 'stdio', command: 'node',
    args: ['${workspaceFolder}/aperio/mcp-server.js'],
  };
  let cfg = { servers: {} };
  let existed = fs.existsSync(dst);
  if (existed) {
    try { cfg = JSON.parse(fs.readFileSync(dst, 'utf8')); } catch { cfg = { servers: {} }; }
    cfg.servers = cfg.servers || {};
  }
  const had = !!(cfg.servers && (cfg.servers.aperio || cfg.servers.codequest));
  if (!had) {
    cfg.servers.aperio = server;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, JSON.stringify(cfg, null, 2) + '\n');
  }
  return had ? 'exists' : (existed ? 'merged' : 'created');
}

const CURSOR_RULE = `---
description: Aperio repo intelligence — master prompt pointer
globs:
  - "**/*"
alwaysApply: true
---

# Aperio (Cursor)

You are **Aperio Core AI**. Read \`aperio/APERIO.md\` — it is your contract —
plus \`.aperio/config.json\` for the audience setting (beginner/professional/expert,
businessLens) and adapt every explanation to it.

Boot: run \`./aperio/bin/aperio scan\` (or read \`.aperio/graph.json\`);
prefer the \`aperio_*\` MCP tools when configured; never fabricate a dependency —
every structural claim carries a \`file:line\` receipt.
`;

const WINDSURF_RULE = `# Aperio (Windsurf)

You are **Aperio Core AI**. Read \`aperio/APERIO.md\` — it is your contract —
plus \`.aperio/config.json\` for the audience setting (beginner/professional/expert,
businessLens) and adapt every explanation to it.

Boot: run \`./aperio/bin/aperio scan\` (or read \`.aperio/graph.json\`);
prefer the \`aperio_*\` MCP tools when configured; never fabricate a dependency —
every structural claim carries a \`file:line\` receipt.
`;

function cmdSetup(dir, packDir, asJson, flags) {
  const env = detectEnvironment();
  const ALL = ['vscode', 'cursor', 'windsurf'];
  let targets = flags.all ? ALL.slice()
    : flags.ide ? String(flags.ide).split(',').map(s => s.trim()).filter(Boolean)
    : env.ides.map(d => d.id).filter(id => ALL.includes(id) || id === 'vscode-insiders');
  if (flags.ide) targets = targets.filter(t => ALL.includes(t) || t === 'vscode-insiders');
  const written = [], skipped = [];
  const put = (repoRel, content) => {
    const full = path.join(dir, repoRel);
    if (flags['dry-run']) { written.push(repoRel + '  (dry-run)'); return; }
    if (fs.existsSync(full)) { skipped.push(repoRel); return; }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    written.push(repoRel);
  };

  // 1. Root AGENTS.md — universal bridge (Copilot, Cursor, Junie, Amp, Zed, …).
  const packAgents = path.join(packDir, 'AGENTS.md');
  if (fs.existsSync(packAgents)) {
    if (flags['dry-run']) written.push('AGENTS.md  (dry-run)');
    else if (!fs.existsSync(path.join(dir, 'AGENTS.md'))) {
      fs.copyFileSync(packAgents, path.join(dir, 'AGENTS.md'));
      written.push('AGENTS.md');
    } else skipped.push('AGENTS.md');
  }

  // 2. Per-IDE configuration.
  const mcpStates = [];
  if (targets.includes('vscode') || targets.includes('vscode-insiders')) {
    for (const f of ['muse-instructions.md', 'agents/aperio.agent.md',
        'instructions/aperio.instructions.md']) {
      const src = path.join(packDir, '.github', ...f.split('/'));
      if (fs.existsSync(src)) {
        const rel = path.join('.github', ...f.split('/'));
        if (flags['dry-run']) written.push(rel + '  (dry-run)');
        else written.push(...copyMissing(src, path.join(dir, rel)));
      }
    }
    const promptsSrc = path.join(packDir, '.github', 'prompts');
    if (fs.existsSync(promptsSrc)) {
      if (flags['dry-run']) written.push('.github/prompts/  (dry-run)');
      else for (const f of copyMissing(promptsSrc, path.join(dir, '.github', 'prompts'))) written.push(f);
    }
    if (!flags['dry-run']) mcpStates.push('.vscode/mcp.json: ' + mergeMcpJson(path.join(dir, '.vscode', 'mcp.json'), packDir));
    else written.push('.vscode/mcp.json  (dry-run)');
  }
  if (targets.includes('cursor')) {
    put('.cursor/rules/aperio.mdc', CURSOR_RULE);
    if (!flags['dry-run']) mcpStates.push('.cursor/mcp.json: ' + mergeMcpJson(path.join(dir, '.cursor', 'mcp.json'), packDir));
    else written.push('.cursor/mcp.json  (dry-run)');
  }
  if (targets.includes('windsurf')) {
    put('.windsurf/rules/aperio.md', WINDSURF_RULE);
    if (!flags['dry-run']) mcpStates.push('.windsurf/mcp.json: ' + mergeMcpJson(path.join(dir, '.windsurf', 'mcp.json'), packDir));
    else written.push('.windsurf/mcp.json  (dry-run)');
  }

  const setupRecord = {
    at: new Date().toISOString(), version: VERSION,
    detected: { ides: env.ides, assistants: env.assistants },
    configured: targets, written: written.filter(w => !w.includes('dry-run')),
    notes: env.notes,
  };
  if (!flags['dry-run']) {
    fs.mkdirSync(path.join(dir, '.aperio'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aperio', 'setup.json'), JSON.stringify(setupRecord, null, 2));
  }

  if (asJson) return out(JSON.stringify(setupRecord, null, 2));
  const L = ['# Aperio setup', ''];
  L.push(`Detected IDEs: ${env.ides.length ? env.ides.map(i => i.name).join(', ') : '(none)'}`);
  L.push(`Detected AI assistants: ${env.assistants.length ? env.assistants.map(a => `${a.name} (${a.via})`).join(', ') : '(none)'}`);
  L.push(`Configured for: ${targets.length ? targets.join(', ') : '(none — use --all or --ide)'}`);
  L.push('');
  L.push(`Wrote ${written.length} file(s):`);
  written.slice(0, 25).forEach(w => L.push(`  + ${w}`));
  if (written.length > 25) L.push(`  …and ${written.length - 25} more`);
  if (skipped.length) { L.push('', `Skipped (already exist): ${skipped.slice(0, 10).join(', ')}${skipped.length > 10 ? '…' : ''}`); }
  if (mcpStates.length) { L.push('', 'MCP:'); mcpStates.forEach(s => L.push(`  ${s}`)); }
  if (env.notes.length) { L.push('', 'Notes:'); env.notes.forEach(n => L.push(`  - ${n}`)); }
  return out(L.join('\n'));
}

module.exports = { cmdSetup, detectEnvironment };
