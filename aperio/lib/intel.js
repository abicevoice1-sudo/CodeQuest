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
/* Fuzzy .env matching — find DB / AI credentials without exact names   */
/* ------------------------------------------------------------------ */

/** Parse KEY=value lines (handles `export`, quotes, comments). Values kept server-side only. */
function parseEnv(text) {
  const vars = [];
  for (let ln of text.split('\n')) {
    ln = ln.trim();
    if (!ln || ln.startsWith('#')) continue;
    ln = ln.replace(/^export\s+/, '');
    const m = ln.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    // strip inline comments not inside quotes
    const q = val[0];
    if (q === '"' || q === "'") {
      const end = val.indexOf(q, 1);
      val = end > 0 ? val.slice(1, end) : val.slice(1);
    } else {
      val = val.split(/\s+#/)[0].trim();
    }
    vars.push({ key: m[1], value: val });
  }
  return vars;
}

function maskSecret(val) {
  if (!val) return '(empty)';
  if (val.length <= 8) return '\u2022'.repeat(Math.min(val.length, 8));
  return val.slice(0, 2) + '\u2022'.repeat(6) + val.slice(-2);
}

// [regex, score] — exact-ish patterns first, loose keyword hits later.
const ENV_DB_PATTERNS = [
  [/database[_-]?url$/i, 100], [/^database[_-]?url/i, 100],
  [/db[_-]?url$/i, 95],
  [/^postgres(ql)?[_-]?url/i, 95], [/^mysql[_-]?url/i, 95], [/^mongo(db)?[_-]?url/i, 95],
  [/^mongodb[_-]?uri/i, 95], [/^redis[_-]?url/i, 90],
  [/^(postgres|mysql|mongo|redis)[_-]/i, 75],
  [/db[_-]?host/i, 70], [/database[_-]?host/i, 70],
  [/db[_-]?name/i, 65], [/database[_-]?name/i, 65],
  [/db[_-]?user/i, 60], [/db[_-]?pass(word)?/i, 60],
  [/^(pg|mysql|mongo)[_-]/i, 55],
  [/(postgres|mysql|mongodb|redis|sqlite)/i, 45],
  [/^db[_-]/i, 40], [/^database[_-]/i, 40],
];

const ENV_AI_PATTERNS = [
  [/openai[_-]?api[_-]?key/i, 100], [/anthropic[_-]?api[_-]?key/i, 100],
  [/^llm[_-]?api[_-]?key/i, 90], [/^ai[_-]?api[_-]?key/i, 90],
  [/openai[_-]?base[_-]?url|openai[_-]?api[_-]?base/i, 85],
  [/anthropic[_-]?base[_-]?url/i, 85],
  [/api[_-]?key$/i, 50], [/^api[_-]?key/i, 50],
  [/(openai|anthropic|llm|gpt|Muse)/i, 45],
  [/base[_-]?url$/i, 35],
  [/(secret|token)[_-]?(key)?$/i, 25],
];

/** Loose fuzzy score: token overlap between key and wanted words (with abbreviation expansion). */
function fuzzyScore(key, words) {
  const abbrev = { pg: 'postgres', mysql: 'mysql', mongo: 'mongodb', redis: 'redis', db: 'database' };
  const tokens = key.toLowerCase().split(/[_-]+/).map((t) => abbrev[t] || t);
  const k = tokens.join(' ');
  let hits = 0;
  for (const w of words) if (k.includes(w)) hits++;
  return hits >= 2 ? 20 + hits * 5 : hits === 1 && /(url|uri|dsn|host|key|secret|token|password)/.test(k) ? 25 : 0;
}

/**
 * Fuzzy-match env vars for a purpose. `kind` is 'db' or 'ai'.
 * Returns [{ key, score, masked, value }] sorted by score desc.
 * Callers must NEVER persist or display raw values — use `masked`.
 */
function fuzzyMatchEnv(text, kind) {
  const patterns = kind === 'ai' ? ENV_AI_PATTERNS : ENV_DB_PATTERNS;
  const words = kind === 'ai'
    ? ['api', 'key', 'openai', 'anthropic', 'llm', 'token', 'model']
    : ['db', 'database', 'postgres', 'mysql', 'mongo', 'redis', 'sqlite', 'sql', 'url', 'host', 'password', 'pass', 'user', 'port'];
  const out = [];
  for (const v of parseEnv(text)) {
    let score = 0;
    for (const [re, s] of patterns) {
      if (re.test(v.key) && s > score) score = s;
    }
    const fz = fuzzyScore(v.key, words);
    if (fz > score) score = fz;
    if (score >= 25 && v.value) out.push({ key: v.key, score, masked: maskSecret(v.value), value: v.value });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
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
    /(?:^|\W)(?:VIS_|SERVER_|HTTP_)?PORT\s*=\s*(\d{2,5})/,
  ];
  let scanned = 0;
  for (const m of modules) {
    if (m.kind !== 'code' || scanned >= 60) continue;
    // Example/fixture/test code skews the vote — the real app's port lives in real code.
    if (/(^|\/)(examples?|fixtures?|__tests?__|tests?|__mocks__|e2e)(\/|$)/i.test(m.id)) continue;
    const text = readText(root, m.id, 120000);
    if (!text) continue;
    scanned++;
    // Entry files get triple weight — the app's real port lives there.
    const weight = m.isEntry ? 3 : 1;
    const head = text.split('\n').slice(0, 250).join('\n');
    for (const re of res) {
      const mt = head.match(re);
      if (mt) {
        const port = parseInt(mt[1], 10);
        if (port >= 10 && port <= 65535) votes.set(port, (votes.get(port) || 0) + weight);
      }
    }
  }
  const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

function readmeSections(root) {
  const cands = listFiles(root, '.').filter((f) => /^readme\.md$/i.test(f));
  if (!cands.length) return [];
  const text = readText(root, cands[0], 200000);
  if (!text) return [];
  const lines = text.split('\n');
  const sections = [];
  let cur = null;
  for (const ln of lines) {
    const h = ln.match(/^(#{1,4})\s+(.+)/);
    if (h) {
      if (cur) sections.push(cur);
      cur = { heading: h[2].trim(), lines: [] };
    } else if (cur && cur.lines.length < 60) {
      cur.lines.push(ln);
    }
  }
  if (cur) sections.push(cur);
  return sections;
}

function extractQuickstart(root) {
  const sections = readmeSections(root);
  const hit = sections.find((s) =>
    /install|getting.?started|quick.?start|usage|running|setup|develop/i.test(s.heading)
  );
  if (!hit) return null;
  const body = hit.lines.filter((l) => l.trim()).slice(0, 14);
  return body.length ? { heading: hit.heading, lines: body } : null;
}

const README_CMD_START = /^(npx|npm|yarn|pnpm|node|python[0-9]?|pip[0-9]?|uv|poetry|pipenv|conda|go|cargo|rustc|docker|git|cd|make|cmake|bundle|ruby|php|composer|java|javac|mvn|gradle|dotnet|kubectl|helm|terraform|tofu|ansible|vagrant|curl|wget|ssh|scp|source|export|echo|mkdir|cp|mv|rm|chmod|chown|sudo|apt|apt-get|brew|dnf|yum|pacman|snap|flatpak|flask|django-admin|uvicorn|gunicorn|celery|redis-server|psql|mysql|mongosh|sqlite3|nvim|vim|code|open|xdg-open|gh|bun|deno)([\s]|$)/i;

/** Pull runnable shell commands out of the README's install/run sections. */
function extractReadmeCommands(root) {
  const sections = readmeSections(root);
  const wanted = sections.filter((s) =>
    /install|getting.?started|quick.?start|usage|running|setup|develop|deploy/i.test(s.heading)
  );
  // Fallback: if no install/run section matched, scan every section's bash blocks.
  const sources = wanted.length ? wanted : sections;
  const commands = [];
  const seen = new Set();
  for (const s of sources) {
    const text = s.lines.join('\n');
    const blocks = [...text.matchAll(/```(?:bash|sh|shell|console)?\n([\s\S]*?)```/g)];
    for (const b of blocks) {
      for (let ln of b[1].split('\n')) {
        ln = ln.trim().replace(/^\$\s*/, '');
        if (!ln || ln.startsWith('#')) continue;
        // must look like an actual shell command, not prose or a file tree
        if (!README_CMD_START.test(ln) && !/^\.\//.test(ln)) continue;
        ln = ln.replace(/\s{2,}#.*$/, '').trim(); // strip trailing "  # comment"
        if (seen.has(ln) || commands.length >= 12) continue;
        seen.add(ln);
        commands.push({ command: ln, section: s.heading });
      }
    }
  }
  return commands;
}

/** Find package.json at root or one level down (monorepo-ish layouts). */
function findPackageJson(root) {
  const direct = readJson(root, 'package.json');
  if (direct) return { pkg: direct, dir: '' };
  for (const d of listFiles(root, '.')) {
    const full = path.join(root, d);
    try {
      if (!fs.statSync(full).isDirectory()) continue;
    } catch { continue; }
    if (d.startsWith('.') || d === 'node_modules') continue;
    const pkg = readJson(root, d + '/package.json');
    if (pkg && pkg.scripts && Object.keys(pkg.scripts).length) return { pkg, dir: d };
  }
  return { pkg: null, dir: '' };
}

/** Python entry guess: manage.py (django) > app.py > main.py > wsgi.py > server.py */
function detectPythonEntry(root) {
  for (const f of ['manage.py', 'app.py', 'main.py', 'wsgi.py', 'server.py']) {
    if (exists(root, f)) return f;
  }
  return null;
}

function detectRunbook(root, modules) {
  const { pkg, dir } = findPackageJson(root);
  const scripts = (pkg && pkg.scripts) || {};
  const cd = dir ? `cd ${dir} && ` : '';

  const langCount = {};
  for (const m of modules) {
    if (m.kind === 'code' && m.lang) langCount[m.lang] = (langCount[m.lang] || 0) + 1;
  }
  const language = (Object.entries(langCount).sort((a, b) => b[1] - a[1])[0] || ['unknown'])[0];

  let pm = null;
  if (exists(root, 'pnpm-lock.yaml')) pm = 'pnpm';
  else if (exists(root, 'yarn.lock')) pm = 'yarn';
  else if (exists(root, 'package-lock.json')) pm = 'npm';
  else if (pkg) pm = 'npm';
  else if (exists(root, 'requirements.txt') || exists(root, 'pyproject.toml') || exists(root, 'setup.py')) pm = 'pip';
  else if (exists(root, 'go.mod')) pm = 'go';
  else if (exists(root, 'Cargo.toml')) pm = 'cargo';

  const steps = [];
  const push = (title, command, source, optional) => {
    if (!steps.some((s) => s.command === command)) steps.push({ title, command, source, optional: !!optional });
  };

  // ---- 1. README first: the repo's own instructions win ----
  const readmeCmds = extractReadmeCommands(root);
  const isInstallCmd = (c) => /install|pip install|npm (install|ci)|yarn|pnpm install|bundle install|go mod|venv/i.test(c);
  const isRunCmd = (c) => /^(npm (run |start)|yarn |pnpm |python |uvicorn |gunicorn |flask |django|node |go run|cargo run|docker)/i.test(c);
  for (const rc of readmeCmds.slice(0, 8)) {
    const title = isInstallCmd(rc.command) ? 'Install dependencies' : isRunCmd(rc.command) ? 'Run the app' : 'From the README';
    push(title, rc.command, 'readme');
  }

  // ---- 2. Detected fallback steps (only for gaps the README didn't cover) ----
  const hasInstall = steps.some((s) => /install/i.test(s.title));
  const hasRun = steps.some((s) => /run the app/i.test(s.title));

  if (pm === 'pip' && !hasInstall) {
    push('Create a virtual environment', 'python -m venv venv', 'detected');
    push('Activate it', 'source venv/bin/activate', 'detected');
    if (exists(root, 'requirements.txt')) push('Install dependencies', 'pip install -r requirements.txt', 'detected');
    else push('Install the package', 'pip install -e .', 'detected');
  } else if (pm === 'pip' && !steps.some((s) => /venv/i.test(s.command))) {
    // README covered install/run but skipped the venv — still recommend it, first.
    steps.unshift(
      { title: 'Create a virtual environment', command: 'python -m venv venv', source: 'detected', optional: false },
      { title: 'Activate it', command: 'source venv/bin/activate', source: 'detected', optional: false },
    );
  } else if (pm === 'go' && !hasInstall) {
    push('Download modules', 'go mod download', 'detected');
  } else if (pm === 'cargo' && !hasInstall) {
    push('Fetch crates', 'cargo fetch', 'detected');
  } else if (pm && !['pip', 'go', 'cargo'].includes(pm) && !hasInstall) {
    push('Install dependencies', `${cd}${pm} install`, 'detected');
  }
  if (exists(root, '.env.example') && !steps.some((s) => /\.env/.test(s.command))) {
    push('Configure environment', 'cp .env.example .env', 'detected');
  }
  if (!hasRun) {
    const runScript = scripts.dev ? 'dev' : scripts.start ? 'start' : null;
    if (runScript && pm && !['pip', 'go', 'cargo'].includes(pm)) {
      const runner = pm === 'npm' ? 'npm run' : pm;
      push('Run the app', `${cd}${runner} ${runScript}`, 'detected');
    } else if (pm === 'pip') {
      const entry = detectPythonEntry(root);
      if (entry === 'manage.py') push('Run the app', 'python manage.py runserver', 'detected');
      else if (entry) push('Run the app', `python ${entry}`, 'detected');
    } else if (pm === 'go') {
      push('Run the app', 'go run .', 'detected');
    } else if (pm === 'cargo') {
      push('Run the app', 'cargo run', 'detected');
    }
  }
  if (scripts.test && !steps.some((s) => /test/i.test(s.command))) {
    const runner = pm === 'npm' ? 'npm test' : pm === 'yarn' || pm === 'pnpm' ? `${pm} test` : null;
    if (runner) push('Run tests', `${cd}${runner}`, 'detected', true);
  }
  const hasCompose = exists(root, 'docker-compose.yml') || exists(root, 'compose.yml') || exists(root, 'compose.yaml');
  if ((hasCompose || exists(root, 'Dockerfile')) && !steps.some((s) => /docker/i.test(s.command))) {
    push('Or run with Docker', hasCompose ? 'docker compose up --build' : 'docker build -t app . && docker run -p 3000:3000 app', 'detected', true);
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

module.exports = { buildIntel, detectRunbook, detectDatabase, extractSchema, explainFlow, fuzzyMatchEnv, parseEnv, cleanForTest: { parsePrisma, parseSql, parseMongoose, parseSqlAlchemy, parseDjango } };
