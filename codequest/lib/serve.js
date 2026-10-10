'use strict';
/* `codequest visualize` — scan the repo, serve the visualizer, open the browser. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { out, fail } = require('./util');
const { buildGraph, runTreeSitterExtract } = require('./scan');
const { fuzzyMatchEnv } = require('./intel');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function openBrowser(url, quiet) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err && !quiet) out(`open this URL in your browser: ${url}`);
    if (err && quiet) console.error(`open this URL in your browser: ${url}`);
  });
}

function cmdVisualize(dir, packRoot, flags) {
  // Always re-scan so the graph matches the code on disk (fast: ~0.2s/250 modules).
  const engine = flags.engine === 'tree-sitter' ? 'tree-sitter' : 'regex';
  let extracted = null;
  if (engine === 'tree-sitter') {
    try { extracted = runTreeSitterExtract(dir); }
    catch (e) { return fail('tree-sitter engine failed: ' + e.message, flags.json); }
  }
  const g = buildGraph(dir, extracted);
  g.engine = engine;
  const cq = path.join(dir, '.codequest');
  fs.mkdirSync(cq, { recursive: true });
  fs.writeFileSync(path.join(cq, 'graph.json'), JSON.stringify(g, null, 2));

  const visDir = path.join(packRoot, 'visualizer');
  if (!fs.existsSync(path.join(visDir, 'index.html'))) {
    return fail('visualizer not bundled with this install — reinstall codequest-ai or build visualizer/', flags.json);
  }

  // Inject the graph so the app boots straight into this repo (no file picker).
  const html = buildPage(visDir, g);

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '/index.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return res.end(html);
    }
    // Scan the repo's .env files for DB / AI credentials (fuzzy match).
    // Permission-gated in the UI: this endpoint only runs when the user clicks "Import from .env".
    // Returns masked values only — secrets never leave the server.
    if (urlPath === '/api/env-scan') {
      const kind = new URL(req.url || '/', 'http://x').searchParams.get('kind') === 'ai' ? 'ai' : 'db';
      const root = path.resolve(dir);
      let text = '';
      for (const f of ['.env', '.env.local']) {
        try { text += '\n' + fs.readFileSync(path.join(root, f), 'utf8'); } catch { /* missing — fine */ }
      }
      const matches = fuzzyMatchEnv(text, kind).map(({ key, score, masked }) => ({ key, score, masked }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ matches }));
    }
    // Introspect a live database and return its real tables + columns.
    // Body: { connectionString }. The secret stays server-side; only the schema is returned.
    if (urlPath === '/api/db-schema' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', async () => {
        try {
          const { connectionString } = JSON.parse(body || '{}');
          if (!connectionString || typeof connectionString !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'missing connection string' }));
          }
          const schema = await introspectDb(connectionString);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(schema));
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: String((e && e.message) || e).slice(0, 300) }));
        }
      });
      return;
    }
    // Read any file in the repo (for the in-UI code viewer). Traversal-safe.
    if (urlPath === '/api/file') {
      const rel = new URL(req.url || '/', 'http://x').searchParams.get('path') || '';
      const root = path.resolve(dir);
      const f = path.resolve(root, rel);
      if (!rel || f === root || !f.startsWith(root + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('forbidden');
      }
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('not found');
      }
      if (fs.statSync(f).size > 512 * 1024) {
        res.writeHead(413, { 'Content-Type': 'text/plain' });
        return res.end('file too large');
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return fs.createReadStream(f).pipe(res);
    }
    const f = path.normalize(path.join(visDir, urlPath));
    if (!f.startsWith(visDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      return fail(`port ${VIS_PORT} is busy — another codequest visualizer is already running. Stop it first.`, flags.json);
    }
    fail('visualizer server failed: ' + e.message, flags.json);
  });
  server.listen(VIS_PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${VIS_PORT}`;
    if (!flags.json) out(`codequest: visualizer live at ${url}  —  Ctrl+C to stop`);
    else out(JSON.stringify({ url }));
    openBrowser(url, !!flags.json);
  });
}

function buildPage(visDir, graph) {
  const safe = JSON.stringify(graph).replace(/</g, '\\u003c');
  return fs.readFileSync(path.join(visDir, 'index.html'), 'utf8')
    .replace('</head>', `<script>window.__CODEQUEST_GRAPH__=${safe};</script>\n</head>`);
}

/** Connect to a live database and return its real tables + columns.
 *  Drivers are loaded dynamically; a missing driver yields a helpful install hint. */
async function introspectDb(connectionString) {
  const cs = connectionString.trim();
  const need = (mod, install) => {
    try { return require(mod); }
    catch {
      const e = new Error(`driver-missing:${mod}`);
      e.installHint = install;
      throw e;
    }
  };
  const tables = [];
  const pushTable = (name, columns) => {
    if (tables.length < 100) tables.push({ name, columns: columns.slice(0, 200), live: true });
  };

  if (/^postgres(ql)?:\/\//i.test(cs)) {
    const { Client } = need('pg', 'npm i pg');
    const client = new Client({ connectionString: cs, connectionTimeoutMillis: 8000 });
    await client.connect();
    try {
      const t = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_name LIMIT 100`
      );
      for (const r of t.rows) {
        const c = await client.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
          [r.table_name]
        );
        pushTable(r.table_name, c.rows.map((x) => ({ name: x.column_name, type: x.data_type })));
      }
    } finally { await client.end(); }
    return { engine: 'PostgreSQL', tables };
  }
  if (/^mysql:\/\//i.test(cs)) {
    const mysql = need('mysql2/promise', 'npm i mysql2');
    const conn = await mysql.createConnection(cs);
    try {
      const [t] = await conn.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name LIMIT 100`
      );
      for (const r of t) {
        const [c] = await conn.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position`,
          [r.TABLE_NAME || r.table_name]
        );
        pushTable(r.TABLE_NAME || r.table_name, c.map((x) => ({ name: x.COLUMN_NAME || x.column_name, type: x.DATA_TYPE || x.data_type })));
      }
    } finally { await conn.end(); }
    return { engine: 'MySQL', tables };
  }
  if (/^mongodb(\+srv)?:\/\//i.test(cs)) {
    const { MongoClient } = need('mongodb', 'npm i mongodb');
    const client = new MongoClient(cs, { serverSelectionTimeoutMS: 8000 });
    await client.connect();
    try {
      const db = client.db();
      const cols = await db.listCollections().toArray();
      for (const col of cols.slice(0, 100)) {
        const sample = await db.collection(col.name).findOne();
        const columns = sample
          ? Object.keys(sample).filter((k) => k !== '_id').slice(0, 200).map((k) => ({ name: k, type: typeof sample[k] }))
          : [];
        pushTable(col.name, columns);
      }
    } finally { await client.close(); }
    return { engine: 'MongoDB', tables };
  }
  // sqlite: a file path (optionally prefixed with sqlite:)
  const sqlitePath = cs.replace(/^sqlite:/i, '');
  if (/\.db$|\.sqlite3?$|\.sqlite$/i.test(sqlitePath) || /^sqlite:/i.test(cs)) {
    const Database = need('better-sqlite3', 'npm i better-sqlite3');
    const db = new Database(sqlitePath, { readonly: true });
    try {
      const t = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 100`).all();
      for (const r of t) {
        const c = db.prepare(`PRAGMA table_info("${r.name.replace(/"/g, '""')}")`).all();
        pushTable(r.name, c.map((x) => ({ name: x.name, type: x.type })));
      }
    } finally { db.close(); }
    return { engine: 'SQLite', tables };
  }
  throw new Error('unsupported connection string — use postgres://, mysql://, mongodb://, or a .db/.sqlite file path');
}

const VIS_PORT = 1337;

/* Copy the drop-in pack (prompts, skills, CI, docs) into the target repo.
   Skips anything already there — never overwrites the user's files. */
function copyPack(dir, packRoot) {
  const SKIP = new Set(['bin/', 'lib/', 'visualizer/']); // tool internals, not the pack
  const pkg = JSON.parse(fs.readFileSync(path.join(packRoot, 'package.json'), 'utf8'));
  const copied = [], skipped = [];
  const putFile = (rel) => {
    const dst = path.join(dir, rel);
    if (fs.existsSync(dst)) { skipped.push(rel); return; }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(packRoot, rel), dst);
    copied.push(rel);
  };
  const walk = (rel) => {
    const st = fs.statSync(path.join(packRoot, rel));
    if (st.isDirectory()) { for (const e of fs.readdirSync(path.join(packRoot, rel))) walk(path.join(rel, e)); }
    else putFile(rel);
  };
  for (const entry of pkg.files || []) {
    if (SKIP.has(entry)) continue;
    const rel = entry.replace(/\/$/, '');
    if (!fs.existsSync(path.join(packRoot, rel))) continue;
    walk(rel);
  }
  return { copied, skipped };
}

function cmdStart(dir, packRoot, asJson, flags) {
  // The super-easy one: copy the pack in, configure the IDE, scan, open the graph.
  const { cmdSetup } = require('./setup');
  const { copied } = copyPack(dir, packRoot);
  if (!asJson) {
    out(copied.length
      ? `codequest: copied the pack into this repo (${copied.length} files)`
      : 'codequest: pack already in this repo');
  }
  cmdSetup(dir, packRoot, asJson, flags);
  if (!asJson) out('');
  cmdVisualize(dir, packRoot, flags);
}

module.exports = { cmdVisualize, cmdStart, buildPage };
