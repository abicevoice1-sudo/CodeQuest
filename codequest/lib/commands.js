'use strict';
/* CLI commands: diff, history, trends, blast-radius, story, repo-map. */
const fs = require('fs');
const path = require('path');
const { out, fail } = require('./util');
const { fmtSize } = require('./scan');
// --------------------------------------------------------------- commands ---

const RISK_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function loadGraphInput(input) {
  // Accepts a directory (uses .codequest/graph.json) or a graph.json path.
  const p = fs.existsSync(input) && fs.statSync(input).isDirectory()
    ? path.join(input, '.codequest', 'graph.json') : input;
  if (!fs.existsSync(p)) {
    console.error(`codequest: no graph found at ${p} — run \`codequest scan\` first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function cmdDiff(oldInput, newInput, asJson, failOn) {
  const og = loadGraphInput(oldInput), ng = loadGraphInput(newInput);
  const om = new Map(og.modules.map(m => [m.id, m]));
  const nm = new Map(ng.modules.map(m => [m.id, m]));
  const addedModules = ng.modules.filter(m => !om.has(m.id)).map(m => m.id);
  const removedModules = og.modules.filter(m => !nm.has(m.id)).map(m => m.id);
  const ekey = (e) => `${e.from}→${e.to}`;
  const oe = new Set(og.edges.map(ekey)), ne = new Set(ng.edges.map(ekey));
  const addedEdges = ng.edges.filter(e => !oe.has(ekey(e)));
  const removedEdges = og.edges.filter(e => !ne.has(ekey(e)));
  const escalations = ng.modules
    .filter(m => om.has(m.id) && RISK_RANK[m.risk] > RISK_RANK[om.get(m.id).risk])
    .map(m => ({ module: m.id, from: om.get(m.id).risk, to: m.risk }));
  const newCritical = ng.modules
    .filter(m => !om.has(m.id) && RISK_RANK[m.risk] >= RISK_RANK.HIGH)
    .map(m => ({ module: m.id, risk: m.risk, fanIn: m.fanIn }));
  const oldCyc = new Set((og.cycles || []).map(c => c.join('>')));
  const newCycles = (ng.cycles || []).filter(c => !oldCyc.has(c.join('>')));
  const newEntries = ng.modules.filter(m => m.isEntry && !(om.has(m.id) && om.get(m.id).isEntry)).map(m => m.id);

  const failures = [];
  if (failOn.includes('critical') && (newCritical.length || escalations.some(e => e.to === 'CRITICAL')))
    failures.push('new/escalated CRITICAL-risk modules');
  if (failOn.includes('cycles') && newCycles.length) failures.push('new circular imports');
  if (failOn.includes('escalations') && escalations.length) failures.push('risk escalations');

  const result = { addedModules, removedModules, addedEdges, removedEdges,
    escalations, newCritical, newCycles, newEntries, failures };
  if (asJson) { out(JSON.stringify(result, null, 2)); }
  else {
    const L = ['# CodeQuest architecture drift'];
    const sec = (t, items, fmt) => {
      L.push('', `## ${t} (${items.length})`);
      L.push(items.length ? items.slice(0, 20).map(fmt).join('\n') : '- none');
    };
    sec('Added modules', addedModules, (m) => `- ${m}`);
    sec('Removed modules', removedModules, (m) => `- ${m}`);
    sec('Added edges', addedEdges, (e) => `- ${e.from}:${e.line} → ${e.to}`);
    sec('Removed edges', removedEdges, (e) => `- ${e.from} → ${e.to}`);
    sec('Risk escalations', escalations, (e) => `- ${e.module}: ${e.from} → [${e.to} RISK]`);
    sec('New HIGH/CRITICAL modules', newCritical, (m) => `- ${m.module} [${m.risk} RISK] (fan-in ${m.fanIn})`);
    sec('New circular imports', newCycles, (c) => `- ${c.join(' → ')}`);
    sec('New entry points', newEntries, (m) => `- ${m}`);
    L.push('', failures.length ? `RESULT: FAIL — ${failures.join('; ')}` : 'RESULT: PASS — no blocking drift');
    out(L.join('\n'));
  }
  if (failures.length) process.exitCode = 1;
}
function cmdHistory(dir, asJson) {
  const g = loadGraphInput(dir);
  const snap = {
    at: new Date().toISOString(),
    modules: g.modules.length, edges: g.edges.length,
    cycles: (g.cycles || []).length,
    entries: g.modules.filter(m => m.isEntry).length,
    critical: g.modules.filter(m => m.risk === 'CRITICAL').length,
    high: g.modules.filter(m => m.risk === 'HIGH').length,
    engine: g.engine || 'regex',
  };
  const p = path.join(dir, '.codequest', 'history.jsonl');
  fs.appendFileSync(p, JSON.stringify(snap) + '\n');
  if (asJson) return out(JSON.stringify(snap, null, 2));
  return out(`codequest: snapshot recorded → .codequest/history.jsonl (${snap.modules} modules, ${snap.critical} critical)`);
}

function cmdTrends(dir, asJson) {
  const p = path.join(dir, '.codequest', 'history.jsonl');
  if (!fs.existsSync(p)) return fail('no history yet — run `codequest history` to record snapshots', asJson);
  const snaps = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  if (asJson) return out(JSON.stringify(snaps, null, 2));
  const L = ['# CodeQuest drift history', '',
    '| Snapshot | Modules | Edges | Cycles | Entries | CRITICAL | HIGH |',
    '|---|---|---|---|---|---|---|'];
  snaps.forEach((s, i) => {
    const prev = snaps[i - 1];
    const d = (k) => prev ? (s[k] - prev[k] >= 0 ? `+${s[k] - prev[k]}` : `${s[k] - prev[k]}`) : '—';
    L.push(`| ${s.at.slice(0, 10)} | ${s.modules} (${d('modules')}) | ${s.edges} (${d('edges')}) | ${s.cycles} | ${s.entries} | ${s.critical} (${d('critical')}) | ${s.high} (${d('high')}) |`);
  });
  return out(L.join('\n'));
}

function dependentsOf(g, id, maxDepth) {
  const byTarget = new Map();
  for (const e of g.edges) {
    if (!byTarget.has(e.to)) byTarget.set(e.to, []);
    byTarget.get(e.to).push(e);
  }
  const levels = []; const seen = new Set([id]);
  let frontier = [id];
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const cur of frontier) {
      for (const e of (byTarget.get(cur) || [])) {
        if (!seen.has(e.from)) { seen.add(e.from); next.push(e.from); }
      }
    }
    if (!next.length) break;
    levels.push(next); frontier = next;
  }
  return levels;
}

function findModule(g, query) {
  const q = query.toLowerCase();
  const exact = g.modules.find(m => m.id.toLowerCase() === q);
  if (exact) return exact;
  const hits = g.modules.filter(m => m.id.toLowerCase().includes(q));
  if (hits.length === 1) return hits[0];
  if (!hits.length) return null;
  return { ambiguous: hits.map(h => h.id) };
}

function modById(g, id) { return g.modules.find(m => m.id === id); }

function cmdBlastRadius(g, target, asJson) {
  const mod = findModule(g, target);
  if (!mod) return fail(`No module matching "${target}"`, asJson);
  if (mod.ambiguous) return fail(`Ambiguous — matches:\n  ${mod.ambiguous.join('\n  ')}`, asJson);
  const upstream = mod.imports.filter(i => i.resolved && modById(g, i.resolved))
    .map(i => ({ file: i.resolved, line: i.line }));
  const levels = dependentsOf(g, mod.id, 3);
  const allDown = levels.flat();
  const tests = allDown.map(id => modById(g, id)).filter(m => m && m.isTest).map(m => m.id);
  const result = {
    module: mod.id, layer: mod.layer, risk: mod.risk,
    fanIn: mod.fanIn, fanOut: mod.fanOut,
    upstream,
    downstream: levels.map((ids, i) => ({ degree: i + 1, modules: ids })),
    affectedTests: tests,
  };
  if (asJson) return out(JSON.stringify(result, null, 2));
  const L = [];
  L.push(`# Blast radius — ${mod.id}`);
  L.push(`Layer: ${mod.layer}   Risk: [${mod.risk} RISK]   fan-in ${mod.fanIn} / fan-out ${mod.fanOut}`);
  L.push('');
  L.push('## Upstream (what this module imports)');
  L.push(upstream.length ? upstream.map(u => `- ${u.file}:${u.line}`).join('\n') : '- (none — leaf or external-only)');
  levels.forEach((ids, i) => {
    L.push('');
    L.push(`## ${['1st','2nd','3rd'][i]}-degree downstream (${ids.length} module${ids.length === 1 ? '' : 's'})`);
    L.push(ids.map(id => `- ${id}`).join('\n'));
  });
  L.push('');
  L.push('## Affected tests');
  L.push(tests.length ? tests.map(t => `- ${t}`).join('\n') : '- (none found — coverage gap)');
  L.push('');
  L.push(`## Flow\n[${mod.id}]`);
  if (levels[0]) levels[0].slice(0, 8).forEach(id => L.push(`   ↑ imported by ${id}`));
  return out(L.join('\n'));
}

function cmdStory(g, entryQ, asJson) {
  const mod = findModule(g, entryQ);
  if (!mod) return fail(`No module matching "${entryQ}"`, asJson);
  if (mod.ambiguous) return fail(`Ambiguous — matches:\n  ${mod.ambiguous.join('\n  ')}`, asJson);
  const steps = []; const visited = new Set();
  const queue = [{ id: mod.id, via: null }];
  while (queue.length && steps.length < 30) {
    const cur = queue.shift();
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    const m = modById(g, cur.id);
    steps.push({ n: steps.length + 1, file: m.id, via: cur.via, layer: m.layer });
    for (const im of m.imports) {
      if (im.resolved && modById(g, im.resolved) && !visited.has(im.resolved)) {
        queue.push({ id: im.resolved, via: { from: m.id, line: im.line } });
      }
    }
  }
  if (asJson) return out(JSON.stringify({ entry: mod.id, steps, note: 'static dependency trace' }, null, 2));
  const L = [`# Story — static dependency trace from ${mod.id}`, ''];
  for (const s of steps) {
    const via = s.via ? `  (via ${s.via.from}:${s.via.line})` : '  (entry point)';
    L.push(`${s.n}. [${s.layer}] ${s.file}${via}`);
  }
  L.push('', '_Static dependency trace — data flow inferred from imports, not observed at runtime._');
  return out(L.join('\n'));
}

function riskTag(r) { return `[${r} RISK]`; }

function repoMapMd(g) {
  const L = [];
  const langs = {};
  const code = g.modules.filter(m => m.kind === 'code' || !m.kind);
  const assets = g.modules.filter(m => m.kind && m.kind !== 'code');
  code.forEach(m => { langs[m.lang] = (langs[m.lang] || 0) + 1; });
  const central = [...code].sort((a, b) => b.fanIn - a.fanIn).slice(0, 10);
  const entries = code.filter(m => m.isEntry);
  L.push(`# CodeQuest repo map`, '');
  L.push(`- Modules: ${g.modules.length} (${code.length} code, ${assets.length} assets)   Edges: ${g.edges.length}`);
  L.push(`- Languages: ${Object.entries(langs).map(([k, v]) => `${k} (${v})`).join(', ')}`);
  L.push(`- Audience: ${g.audience || 'professional'}${g.businessLens ? ' · business lens ON' : ''}`);
  L.push(`- Engine: ${g.engine || 'regex'}${g.engine === 'tree-sitter' ? ' (AST)' : ' (zero-dep scanner)'}`);
  L.push(`- Generated: ${g.generatedAt} (codequest ${g.version}, deterministic static scan)`, '');
  L.push('## Entry points');
  L.push(entries.length ? entries.map(m => `- ${m.id} (${m.lang})`).join('\n') : '- (none detected)');
  L.push('', '## Most central modules (by dependents)');
  L.push('| Module | Layer | Dependents | Risk |');
  L.push('|---|---|---|---|');
  central.forEach(m => L.push(`| ${m.id} | ${m.layer} | ${m.fanIn} | ${riskTag(m.risk)} |`));
  L.push('', '## All modules');
  L.push('| Module | Lang | Layer | Exports | In/Out | Risk |');
  L.push('|---|---|---|---|---|---|');
  code.forEach(m => L.push(`| ${m.id} | ${m.lang} | ${m.layer} | ${m.exports.length} | ${m.fanIn}/${m.fanOut} | ${riskTag(m.risk)} |`));
  if (assets.length) {
    L.push('', `## Assets, configs & docs (${assets.length})`);
    L.push('| Path | Kind | Detail |');
    L.push('|---|---|---|');
    assets.forEach(m => {
      const detail = m.summary || fmtSize(m.size || 0);
      L.push(`| ${m.id} | ${m.kind} | ${detail} |`);
    });
  }
  if (g.cycles && g.cycles.length) {
    L.push('', `## Circular imports (${g.cycles.length})`);
    g.cycles.forEach(c => L.push(`- ${c.join(' → ')}`));
  }
  return L.join('\n');
}

module.exports = { cmdDiff, cmdHistory, cmdTrends, cmdBlastRadius, cmdStory, repoMapMd, riskTag, loadGraphInput, RISK_RANK };
