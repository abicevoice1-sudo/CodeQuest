'use strict';
/* `codequest export [dir] -o report.html` — one self-contained HTML file:
   graph + all source code inlined. Double-click it, email it, host it. No server. */

const fs = require('fs');
const path = require('path');
const { out, fail } = require('./util');
const { buildGraph, runTreeSitterExtract } = require('./scan');

const MAX_FILE = 300 * 1024; // per-file cap
const MAX_TOTAL = 6 * 1024 * 1024; // total embedded source cap

function isBinary(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, 8192, 0);
    for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

function safeJson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function cmdExport(dir, packRoot, outFile, flags) {
  const engine = flags.engine === 'tree-sitter' ? 'tree-sitter' : 'regex';
  let extracted = null;
  if (engine === 'tree-sitter') {
    try { extracted = runTreeSitterExtract(dir); }
    catch (e) { return fail('tree-sitter engine failed: ' + e.message, flags.json); }
  }
  const g = buildGraph(dir, extracted);
  g.engine = engine;

  // Embed source for every module in the graph (text files only).
  const files = {};
  let total = 0, embedded = 0, skipped = 0;
  for (const m of g.modules) {
    const f = path.join(dir, m.id);
    let st;
    try { st = fs.statSync(f); } catch { skipped++; continue; }
    if (!st.isFile() || st.size > MAX_FILE || total > MAX_TOTAL) { skipped++; continue; }
    let content;
    try {
      if (isBinary(f)) { skipped++; continue; }
      content = fs.readFileSync(f, 'utf8');
    } catch { skipped++; continue; }
    files[m.id] = content;
    total += content.length;
    embedded++;
  }

  const visDir = path.join(packRoot, 'visualizer');
  const indexPath = path.join(visDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return fail('visualizer not bundled with this install — reinstall codequest-ai', flags.json);
  }
  let html = fs.readFileSync(indexPath, 'utf8');
  const assetsDir = path.join(visDir, 'assets');

  // Inline the JS bundle.
  html = html.replace(
    /<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/,
    () => {
      const jsFile = fs.readdirSync(assetsDir).find((a) => a.endsWith('.js'));
      const js = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
      return `<script type="module">${js.replace(/<\/script>/g, '<\\/script>')}</script>`;
    }
  );
  // Inline the CSS.
  html = html.replace(
    /<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">/,
    () => {
      const cssFile = fs.readdirSync(assetsDir).find((a) => a.endsWith('.css'));
      const css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
      return `<style>${css.replace(/<\/style>/g, '<\\/style>')}</style>`;
    }
  );
  // Favicon: drop the absolute reference (404s quietly in a file, harmless) — keep it simple.
  html = html.replace('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />', '');

  const payload =
    `<script>window.__CODEQUEST_GRAPH__=${safeJson(g)};` +
    `window.__CODEQUEST_FILES__=${safeJson(files)};</script>`;
  html = html.replace('</head>', `${payload}\n</head>`);

  const dest = outFile || path.join(dir, 'codequest-report.html');
  fs.writeFileSync(dest, html);
  const kb = Math.round(fs.statSync(dest).size / 1024);
  if (!flags.json) {
    out(`codequest: exported ${dest} (${kb} KB)`);
    out(`  ${g.modules.length} modules, ${g.edges.length} edges, ${embedded} files embedded (${skipped} skipped)`);
    out(`  open it anywhere — no server needed.`);
  } else {
    out(JSON.stringify({ file: dest, kb, modules: g.modules.length, edges: g.edges.length, embedded, skipped }));
  }
}

module.exports = { cmdExport };
