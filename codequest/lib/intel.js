'use strict';
/* Repo intelligence — deterministic, zero-dependency (Node stdlib only).
   Answers, for any repo on disk:
   - runbook: how to install & run it (scripts, docker, env, port, README quickstart)
   - database: which engines it talks to, via which libraries, which env vars
   - schema: tables + columns from Prisma / SQL / Mongoose / SQLAlchemy / Django
   - flow: the application's standard flow from its entry point + layer pipeline
   Never fabricates: every claim names its source file. */

const fs = require('fs');
const path = require('path');

const MAX_TABLES = 60;
const MAX_COLS = 120;

function exists(root, rel) {
  try { return fs.existsSync(path.join(root, rel)); } catch { return false; }
}
function readText(root, rel, maxBytes = 300000) {
  try {
    const full = path.join(root, rel);
    if (fs.statSync(full).size > maxBytes) return null;
    return fs.readFileSync(full, 'utf8');
  } catch { return null; }
}
function readJson(root, rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return null; }
}
function listFiles(root, rel) {
  try { return fs.readdirSync(path.join(root, rel)); } catch { return []; }
}

/* ------------------------------------------------------------------ */
/* Runbook: how to run this repo                                       */
/* ------------------------------------------------------------------ */

function detectPort(root, modules) {
  const votes = new Map();
  const res = [
    /process\.env\.PORT\s*\|\|\s*['"]?(\d{2,5})/,
    /\bPORT\s*=\s*['"]?(\d{2,5})/,
    /\.listen\(\s*['"]?(\d{2,5})/,
    /app\.run\([^)]*port\s*=\s*(\d{2,5})/i,
    /run\([^)]*['"]--port['"]\s*,\s*(\d{2,5})/,
  ];
  let scanned = 0;
  for (const m of modules) {
    if (m.kind !== 'code' || scanned >= 60) continue;
    const text = readText(root, m.id, 120000);
    if (!text) continue;
    scanned++;
    const head = text.split('\n').slice(0, 250).join('\n');
    for (const re of res) {
      const mt = head.match(re);
      if (mt) {
        const port = parseInt(mt[1], 10);
        if (port >= 10 && port <= 65535) votes.set(port, (votes.get(port) || 0) + 1);
      }
    }
  }
  const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

function extractQuickstart(root) {
  const cands = listFiles(root, '.').filter((f) => /^readme\.md$/i.test(f));
  if (!cands.length) return null;
  const text = readText(root, cands[0], 200000);
  if (!text) return null;
  const lines = text.split('\n');
  const sections = [];
  let cur = null;
  for (const ln of lines) {
    const h = ln.match(/^(#{1,4})\s+(.+)/);
    if (h) {
      if (cur) sections.push(cur);
      cur = { heading: h[2].trim(), lines: [] };
    } else if (cur && cur.lines.length < 25) {
      cur.lines.push(ln);
    }
  }
  if (cur) sections.push(cur);
  const hit = sections.find((s) =>
    /install|getting.?started|quick.?start|usage|running|setup|develop/i.test(s.heading)
  );
  if (!hit) return null;
  const body = hit.lines.filter((l) => l.trim()).slice(0, 14);
  return body.length ? { heading: hit.heading, lines: body } : null;
}

function detectRunbook(root, modules) {
  const pkg = readJson(root, 'package.json');
  const scripts = (pkg && pkg.scripts) || {};

  const langCount = {};
  for (const m of modules) {
    if (m.kind === 'code' && m.lang) langCount[m.lang] = (langCount[m.lang] || 0) + 1;
  }
  const language = (Object.entries(langCount).sort((a, b) => b[1] - a[1])[0] || ['unknown'])[0];

  let pm = null;
  if (exists(root, 'pnpm-lock.yaml')) pm = 'pnpm';
  else if (exists(root, 'yarn.lock')) pm = 'yarn';
  else if (exists(root, 'package-lock.json')) pm = 'npm';
  else if (exists(root, 'package.json')) pm = 'npm';
  else if (exists(root, 'requirements.txt') || exists(root, 'pyproject.toml') || exists(root, 'setup.py')) pm = 'pip';
  else if (exists(root, 'go.mod')) pm = 'go';
  else if (exists(root, 'Cargo.toml')) pm = 'cargo';

  const steps = [];
  if (pm === 'pip') {
    steps.push({ title: 'Install dependencies', command: 'pip install -r requirements.txt' });
  } else if (pm === 'go') {
    steps.push({ title: 'Download modules', command: 'go mod download' });
  } else if (pm === 'cargo') {
    steps.push({ title: 'Fetch crates', command: 'cargo fetch' });
  } else if (pm) {
    steps.push({ title: 'Install dependencies', command: `${pm} install` });
  }
  if (exists(root, '.env.example')) {
    steps.push({ title: 'Configure environment', command: 'cp .env.example .env' });
  }
  const runScript = scripts.dev ? 'dev' : scripts.start ? 'start' : null;
  if (runScript && pm && !['pip', 'go', 'cargo'].includes(pm)) {
    const runner = pm === 'npm' ? 'npm run' : pm;
    steps.push({ title: 'Run the app', command: `${runner} ${runScript}` });
  } else if (pm === 'pip') {
    const entry = modules.find((m) => m.isEntry && m.lang === 'py');
    if (entry) steps.push({ title: 'Run the app', command: `python ${entry.id}` });
  } else if (pm === 'go') {
    steps.push({ title: 'Run the app', command: 'go run .' });
  }
  if (scripts.test) {
    const runner = pm === 'npm' ? 'npm test' : pm === 'yarn' || pm === 'pnpm' ? `${pm} test` : null;
    if (runner) steps.push({ title: 'Run tests', command: runner, optional: true });
  }
  const hasCompose = exists(root, 'docker-compose.yml') || exists(root, 'compose.yml') || exists(root, 'compose.yaml');
  if (hasCompose) {
    steps.push({ title: 'Or run everything with Docker', command: 'docker compose up --build', optional: true });
  } else if (exists(root, 'Dockerfile')) {
    steps.push({ title: 'Or run with Docker', command: 'docker build -t app . && docker run -p 3000:3000 app', optional: true });
  }

  const port = detectPort(root, modules);
  return {
    language, packageManager: pm,
    scripts: Object.keys(scripts).slice(0, 20),
    steps, port,
    quickstart: extractQuickstart(root),
    hasDocker: hasCompose || exists(root, 'Dockerfile'),
  };
}

/* ------------------------------------------------------------------ */
/* Database: engines, libraries, env vars                              */
/* ------------------------------------------------------------------ */

const DB_FINGERPRINTS = [
  ['pg', 'PostgreSQL', 'sql'], ['pg-promise', 'PostgreSQL', 'sql'],
  ['mysql2', 'MySQL', 'sql'], ['mysql', 'MySQL', 'sql'],
  ['mariadb', 'MariaDB', 'sql'],
  ['mongoose', 'MongoDB', 'document'], ['mongodb', 'MongoDB', 'document'],
  ['@prisma/client', 'PostgreSQL (via Prisma)', 'orm'], ['prisma', 'Prisma ORM', 'orm'],
  ['sequelize', 'Sequelize ORM', 'orm'], ['typeorm', 'TypeORM', 'orm'],
  ['knex', 'Knex (SQL)', 'sql'],
  ['sqlite3', 'SQLite', 'sql'], ['better-sqlite3', 'SQLite', 'sql'],
  ['redis', 'Redis', 'kv'], ['ioredis', 'Redis', 'kv'],
  ['psycopg2', 'PostgreSQL', 'sql'], ['psycopg', 'PostgreSQL', 'sql'],
  ['sqlalchemy', 'SQLAlchemy ORM', 'orm'], ['pymongo', 'MongoDB', 'document'],
  ['django.db', 'Django ORM', 'orm'], ['aiosqlite', 'SQLite', 'sql'],
  ['lib/pq', 'PostgreSQL', 'sql'], ['go-sql-driver', 'MySQL', 'sql'],
  ['gorm', 'GORM', 'orm'], ['mongo-driver', 'MongoDB', 'document'],
];

const DB_ENV_VARS = ['DATABASE_URL', 'MONGODB_URI', 'MONGO_URL', 'REDIS_URL', 'DB_HOST', 'DB_URL', 'POSTGRES_URL', 'MYSQL_URL'];

function detectDatabase(root, modules) {
  const engines = new Map(); // engine -> { engine, kind, via: Set }
  const hit = (frag, file) => {
    const fp = DB_FINGERPRINTS.find(([f]) => frag === f || frag.endsWith('/' + f) || frag === '@' + f);
    if (!fp) return;
    const [, engine, kind] = fp;
    if (!engines.has(engine)) engines.set(engine, { engine, kind, via: [] });
    const via = engines.get(engine).via;
    if (file && !via.includes(file) && via.length < 6) via.push(file);
  };

  const pkg = readJson(root, 'package.json');
  const deps = Object.keys({ ...((pkg && pkg.dependencies) || {}), ...((pkg && pkg.devDependencies) || {}) });
  for (const d of deps) hit(d, 'package.json');

  let reqs = '';
  for (const f of ['requirements.txt', 'pyproject.toml']) {
    const t = readText(root, f, 60000);
    if (t) reqs += '\n' + t;
  }
  for (const fp of DB_FINGERPRINTS) {
    if (new RegExp(`^${fp[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[=<>~!\\s]`, 'im').test(reqs)) hit(fp[0], 'requirements');
  }
  const goMod = readText(root, 'go.mod', 60000);
  if (goMod) for (const fp of DB_FINGERPRINTS) if (goMod.includes(fp[0])) hit(fp[0], 'go.mod');

  for (const m of modules) {
    if (m.kind !== 'code') continue;
    for (const im of m.imports || []) {
      const raw = (im.raw || '').toLowerCase();
      for (const [frag] of DB_FINGERPRINTS) {
        if (raw === frag || raw.endsWith('/' + frag)) { hit(frag, m.id); break; }
      }
    }
  }

  // Env vars: names + file only — never values.
  const envVars = [];
  const configCands = modules
    .filter((m) => m.kind === 'code' && /config|database|\bdb\b|env/i.test(m.id))
    .slice(0, 25);
  for (const m of configCands) {
    const text = readText(root, m.id, 80000);
    if (!text) continue;
    for (const v of DB_ENV_VARS) {
      if (text.includes(v) && !envVars.some((e) => e.name === v)) {
        envVars.push({ name: v, file: m.id });
      }
    }
  }

  let prismaSchema = null;
  for (const m of modules) {
    if (m.id.endsWith('schema.prisma')) { prismaSchema = m.id; break; }
  }

  return {
    engines: [...engines.values()],
    envVars,
    prismaSchema,
  };
}

/* ------------------------------------------------------------------ */
/* Schema: tables + columns                                            */
/* ------------------------------------------------------------------ */

function balanced(text, openIdx) {
  // openIdx points at the opening brace; returns the inner text.
  const open = text[openIdx];
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const close = pairs[open];
  if (!close) return null;
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return null;
}

function parsePrisma(text, source) {
  const tables = [];
  const re = /model\s+(\w+)\s*\{/g;
  let m;
  while ((m = re.exec(text)) && tables.length < MAX_TABLES) {
    const brace = text.indexOf('{', m.index);
    const body = balanced(text, brace);
    if (body == null) continue;
    const mapM = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
    const columns = [];
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('@@')) continue;
      const parts = t.split(/\s+/);
      if (parts.length >= 2 && /^[A-Za-z_]\w*$/.test(parts[0]) && /^[A-Za-z_][\w\[\]?]*$/.test(parts[1])) {
        const optional = parts[1].endsWith('?');
        columns.push({ name: parts[0], type: parts[1].replace(/\?$/, '') + (optional ? '?' : '') });
        if (columns.length >= MAX_COLS) break;
      }
    }
    tables.push({ name: mapM ? mapM[1] : m[1], model: m[1], source, columns, orm: 'prisma' });
  }
  return tables;
}

function splitTopLevel(body) {
  const cols = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { cols.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) cols.push(cur);
  return cols;
}

function parseSql(text, source) {
  const tables = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`\[]?(\w+)["'`\]]?\s*\(/gi;
  let m;
  while ((m = re.exec(text)) && tables.length < MAX_TABLES) {
    const brace = text.indexOf('(', m.index);
    const body = balanced(text, brace);
    if (body == null) continue;
    const columns = [];
    for (const c of splitTopLevel(body)) {
      const t = c.trim().replace(/--.*$/, '').trim();
      if (!t || /^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|CHECK|KEY|INDEX)\b/i.test(t)) continue;
      const cm = t.match(/^["'`\[]?(\w+)["'`\]]?\s+([A-Za-z]+(?:\s*\([^)]*\))?)/);
      if (cm) {
        columns.push({ name: cm[1], type: cm[2].trim() });
        if (columns.length >= MAX_COLS) break;
      }
    }
    // jump past this statement's closing paren for the next search
    tables.push({ name: m[1], source, columns, orm: 'sql' });
    re.lastIndex = brace + (body ? body.length : 0);
  }
  return tables;
}

function parseMongoose(text, source) {
  const tables = [];
  const re = /new\s+(?:mongoose\.)?Schema\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(text)) && tables.length < MAX_TABLES) {
    const brace = text.indexOf('{', m.index);
    const body = balanced(text, brace);
    if (body == null) continue;
    // find mongoose.model('Name', ...) after this schema
    const after = text.slice(m.index, m.index + 2000);
    const modelM = after.match(/(?:mongoose\.)?model\s*\(\s*["'`](\w+)["'`]/);
    const columns = [];
    for (const c of splitTopLevel(body)) {
      const t = c.trim();
      const cm = t.match(/^(\w+)\s*:\s*(?:\{\s*type\s*:\s*)?([A-Za-z]+)/);
      if (cm && !/^(type|required|default|ref|enum|index|unique)$/i.test(cm[1])) {
        columns.push({ name: cm[1], type: cm[2] });
        if (columns.length >= MAX_COLS) break;
      }
    }
    tables.push({ name: modelM ? modelM[1] : `schema@${source}`, source, columns, orm: 'mongoose' });
  }
  return tables;
}

function parseSqlAlchemy(text, source) {
  const tables = [];
  const classRe = /class\s+(\w+)\s*\([^)]*\)\s*:/g;
  let m;
  while ((m = classRe.exec(text)) && tables.length < MAX_TABLES) {
    // class body: until next top-level class/def or EOF (indent-based, best-effort)
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const endM = rest.match(/\nclass\s+\w+\s*\(/);
    const body = endM ? rest.slice(0, endM.index) : rest;
    const tabM = body.match(/__tablename__\s*=\s*["'`](\w+)["'`]/);
    if (!tabM) continue;
    const columns = [];
    const colRe = /^\s*(\w+)\s*=\s*Column\s*\(\s*([A-Za-z]+)/gm;
    let cm;
    while ((cm = colRe.exec(body)) && columns.length < MAX_COLS) {
      columns.push({ name: cm[1], type: cm[2] });
    }
    if (columns.length) tables.push({ name: tabM[1], model: m[1], source, columns, orm: 'sqlalchemy' });
  }
  return tables;
}

function parseDjango(text, source) {
  const tables = [];
  const classRe = /class\s+(\w+)\s*\(\s*models\.Model\s*\)\s*:/g;
  let m;
  while ((m = classRe.exec(text)) && tables.length < MAX_TABLES) {
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const endM = rest.match(/\nclass\s+\w+\s*\(/);
    const body = endM ? rest.slice(0, endM.index) : rest;
    const columns = [];
    const fRe = /^\s*(\w+)\s*=\s*models\.(\w+)\s*\(/gm;
    let fm;
    while ((fm = fRe.exec(body)) && columns.length < MAX_COLS) {
      columns.push({ name: fm[1], type: fm[2] });
    }
    if (columns.length) tables.push({ name: m[1].toLowerCase() + 's', model: m[1], source, columns, orm: 'django' });
  }
  return tables;
}

function extractSchema(root, modules) {
  const tables = [];
  const seen = new Set();
  const add = (ts) => {
    for (const t of ts) {
      const key = t.orm + ':' + t.name;
      if (seen.has(key) || tables.length >= MAX_TABLES) continue;
      seen.add(key);
      tables.push(t);
    }
  };
  for (const m of modules) {
    if (tables.length >= MAX_TABLES) break;
    if (m.id.endsWith('schema.prisma')) {
      const text = readText(root, m.id);
      if (text) add(parsePrisma(text, m.id));
    } else if (/\.sql$/i.test(m.id)) {
      const text = readText(root, m.id);
      if (text) add(parseSql(text, m.id));
    } else if (m.kind === 'code' && (m.lang === 'js' || m.lang === 'ts')) {
      const text = readText(root, m.id, 150000);
      if (text && /new\s+(?:mongoose\.)?Schema\s*\(/.test(text)) add(parseMongoose(text, m.id));
    } else if (m.kind === 'code' && m.lang === 'py') {
      const text = readText(root, m.id, 150000);
      if (!text) continue;
      if (/Column\s*\(/.test(text) && /__tablename__/.test(text)) add(parseSqlAlchemy(text, m.id));
      else if (/models\.Model/.test(text)) add(parseDjango(text, m.id));
    }
  }
  return { tables };
}

/* ------------------------------------------------------------------ */
/* Flow: the application's standard flow                                */
/* ------------------------------------------------------------------ */

function explainFlow(graph) {
  const entries = graph.modules.filter((m) => m.isEntry && m.kind === 'code');
  if (!entries.length) return null;
  const primary = [...entries].sort(
    (a, b) => b.fanOut - a.fanOut || b.fanIn - a.fanIn
  )[0];

  const adj = new Map();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  }
  const steps = [];
  const seen = new Set([primary.id]);
  const queue = [{ id: primary.id, depth: 0, via: null }];
  while (queue.length && steps.length < 30) {
    const cur = queue.shift();
    if (cur.depth > 0) steps.push({ file: cur.id, depth: cur.depth, via: cur.via });
    for (const nxt of adj.get(cur.id) || []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        queue.push({ id: nxt, depth: cur.depth + 1, via: cur.id });
      }
    }
  }

  const modById = new Map(graph.modules.map((m) => [m.id, m]));
  const pipe = new Map();
  for (const e of graph.edges) {
    const a = modById.get(e.from)?.layer;
    const b = modById.get(e.to)?.layer;
    if (a && b && a !== b) {
      const k = a + '>' + b;
      pipe.set(k, (pipe.get(k) || 0) + 1);
    }
  }
  const pipeline = [...pipe.entries()]
    .map(([k, count]) => {
      const [from, to] = k.split('>');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    primaryEntry: primary.id,
    entryCount: entries.length,
    entries: entries.map((e) => e.id).slice(0, 10),
    steps,
    pipeline,
  };
}

/* ------------------------------------------------------------------ */

function buildIntel(root, modules, edges) {
  const codeModules = modules.filter((m) => m.kind === 'code');
  return {
    runbook: detectRunbook(root, codeModules),
    database: detectDatabase(root, codeModules),
    schema: extractSchema(root, modules), // schema files (.prisma/.sql) aren't "code"
    flow: explainFlow({ modules: codeModules, edges }),
  };
}

module.exports = { buildIntel, detectRunbook, detectDatabase, extractSchema, explainFlow, cleanForTest: { parsePrisma, parseSql, parseMongoose, parseSqlAlchemy, parseDjango } };
