'use strict';
/* Graph engine: walking, parsing, import resolution, risk scoring, cycles. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const VERSION = '1.3.0';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next',
  'vendor', '__pycache__', '.venv', 'venv', 'target', '.codequest', '.idea', '.vscode']);
const EXT_LANG = {
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.go': 'go', '.java': 'java', '.rb': 'ruby', '.php': 'php',
};
// Non-code files the analyzer inventories (and shows in the repo map).
const ASSET_KIND = {
  '.json': 'config', '.yaml': 'config', '.yml': 'config', '.toml': 'config', '.ini': 'config',
  '.md': 'doc', '.mdx': 'doc', '.rst': 'doc', '.txt': 'doc', '.pdf': 'doc',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.svg': 'image',
  '.webp': 'image', '.ico': 'image', '.bmp': 'image',
  '.sql': 'data', '.csv': 'data', '.tsv': 'data',
};
const ASSET_BASENAMES = { // dotfiles / extensionless, matched on lowercase basename
  'dockerfile': 'config', 'makefile': 'config', 'jenkinsfile': 'config',
  '.env': 'config', '.env.local': 'config', '.env.example': 'config', '.env.production': 'config',
};
const ASSET_LAYER = { config: 'Config', doc: 'Doc', image: 'Asset', data: 'Data' };
const MAX_FILE_BYTES = 512 * 1024;

// ---------------------------------------------------------------- walking ---

function fileKind(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (EXT_LANG[ext]) return { kind: 'code', lang: EXT_LANG[ext] };
  const base = path.basename(rel).toLowerCase();
  if (ASSET_BASENAMES[base]) return { kind: ASSET_KIND[ext] || ASSET_BASENAMES[base] };
  if (ASSET_KIND[ext]) return { kind: ASSET_KIND[ext] };
  return null;
}

function walk(dir, root, out) {
  out = out || [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.github') {
      if (SKIP_DIRS.has(e.name)) continue;
    }
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, root, out);
    else if (e.isFile()) {
      const rel = path.relative(root, full);
      if (!fileKind(rel)) continue;
      try {
        const st = fs.statSync(full);
        if (st.size > MAX_FILE_BYTES) continue;
        out.push({ rel, size: st.size });
      } catch { continue; }
    }
  }
  out.sort((a, b) => (a.rel < b.rel ? -1 : 1));
  return out;
}

function summarizeAsset(full, kind, ext) {
  try {
    if (kind === 'config' && ext === '.json') {
      const obj = JSON.parse(fs.readFileSync(full, 'utf8'));
      const keys = Object.keys(obj).slice(0, 8).join(', ');
      return keys ? `keys: ${keys}` : 'empty object';
    }
    if ((kind === 'config' && (ext === '.yaml' || ext === '.yml')) || ext === '.toml') {
      const keys = [...fs.readFileSync(full, 'utf8').matchAll(/^([A-Za-z_][\w-]*):/gm)]
        .map(m => m[1]).slice(0, 8).join(', ');
      return keys ? `keys: ${keys}` : '';
    }
    if (kind === 'doc' && (ext === '.md' || ext === '.mdx')) {
      const heads = [...fs.readFileSync(full, 'utf8').matchAll(/^#{1,3}\s+(.+)$/gm)]
        .map(m => m[1].trim()).slice(0, 5).join(' · ');
      return heads || '';
    }
  } catch { /* binary or unparseable — fall through to size */ }
  return '';
}

function fmtSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// --------------------------------------------------------------- parsing ---

function parseJS(lines) {
  const imports = [], exports = [];
  const reImportFrom = /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/;
  const reExportFrom = /^\s*export\s+(?:[^'"]*?\s+from\s+)['"]([^'"]+)['"]/;
  const reExportStar = /^\s*export\s+\*\s*(?:as\s+[A-Za-z_$][\w$]*\s+)?from\s+['"]([^'"]+)['"]/;
  const reRequire = /(?:^|[^.\w$])require\s*\(\s*['"]([^'"]+)['"]\s*\)/;
  const reDynImport = /(?:^|[^.\w$])import\s*\(\s*['"]([^'"]+)['"]\s*\)/;
  const reExportDecl = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/;
  const reExportList = /^\s*export\s*\{([^}]*)\}/;
  const reModuleExports = /^\s*(?:module\.exports|exports)(?:\.([A-Za-z_$][\w$]*))?\s*=/;
  lines.forEach((ln, i) => {
    const line = i + 1;
    let m;
    if ((m = ln.match(reExportStar))) imports.push({ raw: m[1], line, reexport: true });
    else if ((m = ln.match(reImportFrom))) imports.push({ raw: m[1], line });
    else if ((m = ln.match(reExportFrom))) { imports.push({ raw: m[1], line, reexport: true }); }
    else if ((m = ln.match(reRequire))) imports.push({ raw: m[1], line });
    else if ((m = ln.match(reDynImport))) imports.push({ raw: m[1], line });
    if ((m = ln.match(reExportDecl))) exports.push(m[1]);
    else if ((m = ln.match(reExportList))) {
      m[1].split(',').forEach(s => {
        const name = s.trim().split(/\s+as\s+/).pop().trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) exports.push(name);
      });
    } else if ((m = ln.match(reModuleExports))) exports.push(m[1] || 'module.exports');
  });
  return { imports, exports };
}

function parsePy(lines) {
  const imports = [], exports = [];
  const reImp = /^\s*import\s+([a-zA-Z_][\w.]*(?:\s*,\s*[a-zA-Z_][\w.]*)*)/;
  const reFrom = /^\s*from\s+(\.*[a-zA-Z_]?[\w.]*)\s+import\s+(.+)/;
  const reDef = /^\s*(?:def|class)\s+([A-Za-z_]\w*)/;
  lines.forEach((ln, i) => {
    const line = i + 1;
    let m;
    if ((m = ln.match(reImp))) {
      m[1].split(',').forEach(s => imports.push({ raw: s.trim().split(/\s+as\s+/)[0].trim(), line }));
    } else if ((m = ln.match(reFrom))) {
      const raw = m[1].trim() || '.';
      imports.push({ raw, line, names: m[2].trim(), relative: raw.startsWith('.') });
    } else if ((m = ln.match(reDef)) && !ln.startsWith(' ') && !ln.startsWith('\t')) {
      exports.push(m[1]);
    }
  });
  return { imports, exports };
}

function parseGo(lines) {
  const imports = [], exports = [];
  const reSingle = /^\s*import\s+(?:[\w.]+\s+)?"([^"]+)"/;
  const reBlockItem = /^\s*(?:[\w.]+\s+)?"([^"]+)"\s*$/;
  const reFunc = /^\s*func\s+(?:\([^)]*\)\s+)?([A-Z][\w]*)\s*\(/;
  let inBlock = false;
  lines.forEach((ln, i) => {
    const line = i + 1;
    let m;
    if (/^\s*import\s*\($/.test(ln)) { inBlock = true; return; }
    if (inBlock && /^\s*\)/.test(ln)) { inBlock = false; return; }
    if (inBlock && (m = ln.match(reBlockItem))) { imports.push({ raw: m[1], line }); return; }
    if ((m = ln.match(reSingle))) imports.push({ raw: m[1], line });
    else if ((m = ln.match(reFunc))) exports.push(m[1]);
  });
  return { imports, exports };
}

function parseJava(lines) {
  const imports = [], exports = [];
  const reImp = /^\s*import\s+(?:static\s+)?([\w.]+)(?:\.\*)?;/;
  const reClass = /^\s*(?:public\s+)?(?:final\s+)?(?:class|interface|enum)\s+([A-Za-z_]\w*)/;
  lines.forEach((ln, i) => {
    const line = i + 1;
    let m;
    if ((m = ln.match(reImp))) imports.push({ raw: m[1], line });
    else if ((m = ln.match(reClass))) exports.push(m[1]);
  });
  return { imports, exports };
}

const PARSERS = { javascript: parseJS, typescript: parseJS, python: parsePy, go: parseGo, java: parseJava };

// ------------------------------------------------------------- resolving ---

const CANDIDATE_EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.java', '.rb', '.php', '.json'];

function tryFile(root, p) {
  for (const ext of CANDIDATE_EXTS) {
    const c = p + ext;
    try { if (fs.statSync(path.join(root, c)).isFile()) return c; } catch {}
  }
  for (const ext of CANDIDATE_EXTS.slice(1)) {
    const c = path.join(p, 'index' + ext);
    try { if (fs.statSync(path.join(root, c)).isFile()) return c; } catch {}
  }
  return null;
}

function resolveImport(root, fromRel, raw, lang, aliases, names) {
  if (raw.startsWith('.')) {
    // Relative import: ./x, ../x (JS/TS) and .mod, ..pkg, . (python explicit-relative).
    const dots = raw.match(/^(\.+)/)[1].length;
    let rest = raw.slice(dots);
    rest = rest.startsWith('/') ? rest.slice(1) : rest.replace(/\./g, '/');
    let base = path.dirname(fromRel);
    for (let i = 1; i < dots; i++) base = path.dirname(base); // 1 dot = same dir
    if (rest) {
      const hit = tryFile(root, path.join(base, rest));
      // Unresolved relative imports are reported honestly (null) — never
      // guessed. (Falling back to the directory index here would mask broken
      // imports and fabricate cycles.)
      return hit || null;
    }
    if (lang === 'python') {
      if (names) {
        // `from . import x` → sibling module x
        const first = names.split(',')[0].trim().split(/\s+/)[0];
        if (/^[A-Za-z_]\w*$/.test(first)) {
          const hit = tryFile(root, path.join(base, first));
          if (hit) return hit;
        }
      }
      return tryFile(root, path.join(base, '__init__')); // package init fallback
    }
    return null;
  }
  if ((lang === 'javascript' || lang === 'typescript') && aliases) {
    for (const { prefix, target } of aliases) {
      if (raw === prefix || raw.startsWith(prefix + '/')) {
        const hit = tryFile(root, path.join(target, raw.slice(prefix.length)));
        if (hit) return hit;
      }
    }
  }
  if (lang === 'python' && /^[a-zA-Z_][\w.]*$/.test(raw)) {
    // absolute python import: try foo/bar.py, foo/bar/__init__.py (from root,
    // then relative to the importing file for sibling-style imports)
    const base = raw.replace(/\./g, '/');
    return tryFile(root, base) || tryFile(root, path.join(base, '__init__')) ||
      tryFile(root, path.join(path.dirname(fromRel), base));
  }
  return null; // external / bare import
}

function loadAliases(root) {
  // tsconfig.json / jsconfig.json `paths` (e.g. "@/*": ["src/*"]) for JS/TS.
  const aliases = [];
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    try {
      const text = fs.readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      const cfg = JSON.parse(text);
      const baseUrl = (cfg.compilerOptions && cfg.compilerOptions.baseUrl) || '.';
      const paths = (cfg.compilerOptions && cfg.compilerOptions.paths) || {};
      for (const [key, vals] of Object.entries(paths)) {
        const prefix = key.replace(/\/\*$/, '');
        const target = (vals[0] || '').replace(/\/\*$/, '');
        if (prefix) aliases.push({ prefix, target: path.normalize(path.join(baseUrl, target)) });
      }
    } catch { /* malformed config — ignore */ }
  }
  return aliases;
}

// ----------------------------------------------------------------- graph ---

function guessLayer(rel, isEntry, isTest) {
  const p = rel.toLowerCase();
  if (isTest) return 'Test';
  if (isEntry) return 'Entry';
  if (/middleware/.test(p)) return 'Middleware';
  if (/(^|\/)(routes?|router|controllers?|handlers?|api|urls\.py|views\.py)(\/|$)/.test(p)) return 'API Route';
  if (/(^|\/)(services?|lib)(\/|$)/.test(p)) return 'Service';
  if (/(^|\/)(models?|schemas?|entities)(\/|$)/.test(p)) return 'Model/Schema';
  if (/(^|\/)(db|database|repositories?|dao)(\/|$)/.test(p)) return 'Data Access';
  if (/(^|\/)(components?|views?|pages?|ui)(\/|$)/.test(p)) return 'UI Component';
  if (/(^|\/)(store|state|context|redux)(\/|$)/.test(p)) return 'State';
  if (/(^|\/)(utils?|helpers?|common|shared)(\/|$)/.test(p)) return 'Shared Utility';
  if (/(^|\/)(config|settings)(\/|$)/.test(p)) return 'Config';
  if (/(^|\/)(scripts?|bin|tools)(\/|$)/.test(p)) return 'Script';
  return 'Domain';
}

function isTestFile(rel) {
  const p = rel.toLowerCase();
  return p.includes('__tests__') || /(^|\/)(test|tests)(\/|$)/.test(p) ||
    /\.(test|spec)\.[a-z]+$/.test(p) || /(^|\/)test_[^/]*\.py$/.test(p) ||
    /_test\.go$/.test(p);
}

function detectEntry(content, lang, rel, ctx) {
  const p = rel.toLowerCase();
  if (lang === 'javascript' || lang === 'typescript') {
    if (/app\.(get|post|put|patch|delete|use|listen)\s*\(/.test(content)) return true; // express
    if (/createBrowserRouter\s*\(/.test(content)) return true; // react-router
    // next.js page routes — only when the repo is actually a Next.js app
    if (ctx.isNextJs && /(^|\/)app\//.test(p) && /page\.[a-z]+$/.test(p)) return true;
    if (/createServer\s*\(/.test(content) || /program\.(command|parse)\s*\(/.test(content)) return true;
    return false;
  }
  if (lang === 'python') {
    if (/if\s+__name__\s*==\s*['"]__main__['"]/.test(content)) return true;
    if (/@app\.(get|post|put|patch|delete|route)\s*\(/.test(content)) return true; // flask/fastapi
    if (/@(router|api)\.(get|post|put|patch|delete|route)\s*\(/.test(content)) return true; // fastapi router
    if (/urlpatterns\s*=/.test(content)) return true; // django urls
    return false;
  }
  if (lang === 'go') return /^\s*func\s+main\s*\(/m.test(content);
  if (lang === 'java') {
    if (/public\s+static\s+void\s+main\s*\(/.test(content)) return true;
    if (/@SpringBootApplication/.test(content)) return true;
    if (/@RestController/.test(content)) return true;
    return false;
  }
  if (lang === 'ruby') {
    if (/Rails\.application\.routes\.draw/.test(content)) return true;
    if (/<\s*ApplicationController/.test(content)) return true;
    return false;
  }
  if (lang === 'php') {
    if (/Route::(get|post|put|patch|delete)\s*\(/.test(content)) return true; // laravel
    if (/Artisan::/.test(content)) return true;
    return false;
  }
  return false;
}

function buildGraph(root, extractedMap) {
  const files = walk(root, root);
  const aliases = loadAliases(root);
  const ctx = {
    // next.js repo signals — gates the app/page.tsx entry heuristic
    isNextJs: ['next.config.js', 'next.config.mjs', 'next.config.ts'].some(f =>
      fs.existsSync(path.join(root, f))),
  };
  const modules = new Map();
  for (const { rel, size } of files) {
    const fk = fileKind(rel);
    const full = path.join(root, rel);
    if (fk.kind !== 'code') {
      // Asset: inventoried, never parsed. Shown in the repo map.
      const ext = path.extname(rel).toLowerCase();
      modules.set(rel, {
        id: rel, path: rel, kind: fk.kind, lang: 'asset',
        lines: 0, size, summary: summarizeAsset(full, fk.kind, ext),
        exports: [], imports: [], isTest: false, isEntry: false,
        layer: ASSET_LAYER[fk.kind], fanIn: 0, fanOut: 0,
      });
      continue;
    }
    const lang = fk.lang;
    let imports, exports, lineCount;
    const te = extractedMap && extractedMap.get(rel);
    if (te) {
      // Tree-sitter AST extraction (zero false positives from comments/strings).
      ({ imports, exports } = te);
      lineCount = te.lines;
    } else {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      const parser = PARSERS[lang] || (() => ({ imports: [], exports: [] }));
      ({ imports, exports } = parser(lines));
      lineCount = lines.length;
    }
    const test = isTestFile(rel);
    // Entry detection reuses the heuristic pass (cheap content read; the AST
    // engine's job is import/export accuracy, not entry heuristics).
    let entry = false;
    if (!test) {
      const content = fs.readFileSync(full, 'utf8');
      entry = detectEntry(content, lang, rel, ctx);
    }
    modules.set(rel, {
      id: rel, path: rel, kind: 'code', lang, lines: lineCount,
      exports, isTest: test, isEntry: entry,
      layer: guessLayer(rel, entry, test),
      imports: imports.map(im => ({
        raw: im.raw, line: im.line, reexport: !!im.reexport,
        resolved: resolveImport(root, rel, im.raw, lang, aliases, im.names),
      })),
      fanIn: 0, fanOut: 0,
    });
  }
  const edges = [];
  for (const m of modules.values()) {
    const seen = new Set();
    for (const im of m.imports) {
      if (im.resolved && modules.has(im.resolved) && im.resolved !== m.id && !seen.has(im.resolved)) {
        seen.add(im.resolved);
        edges.push({ from: m.id, to: im.resolved, line: im.line });
        m.fanOut++;
        modules.get(im.resolved).fanIn++;
      }
    }
  }
  // risk: heuristic, documented
  for (const m of modules.values()) {
    let risk = 'LOW';
    if (m.fanIn >= 8) risk = 'CRITICAL';
    else if (m.fanIn >= 4) risk = 'HIGH';
    else if (m.fanIn >= 2) risk = 'MEDIUM';
    m.risk = m.isTest ? 'LOW' : risk;
  }
  const cycles = findCycles([...modules.keys()], edges);
  // Audience settings (see `codequest init`): prompts adapt explanations to it.
  let audience = 'professional', businessLens = false;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, '.codequest', 'config.json'), 'utf8'));
    if (cfg.audience) audience = cfg.audience;
    if (cfg.businessLens) businessLens = true;
  } catch { /* no config — defaults */ }
  return {
    version: VERSION, root: path.resolve(root), generatedAt: new Date().toISOString(),
    audience, businessLens,
    modules: [...modules.values()], edges, cycles,
  };
}

function findCycles(nodeIds, edges) {
  const adj = new Map(nodeIds.map(id => [id, []]));
  for (const e of edges) adj.get(e.from).push(e.to);
  const cycles = [];
  const visited = new Set(), onStack = new Set(), stack = [];
  const canon = (cyc) => {
    const inner = cyc.slice(0, -1);
    const min = inner.reduce((a, b) => (a < b ? a : b));
    const i = inner.indexOf(min);
    return [...inner.slice(i), ...inner.slice(0, i), min].join('>');
  };
  const seen = new Set();
  function dfs(n) {
    visited.add(n); onStack.add(n); stack.push(n);
    for (const t of adj.get(n) || []) {
      if (!visited.has(t)) dfs(t);
      else if (onStack.has(t)) {
        const cyc = [...stack.slice(stack.indexOf(t)), t];
        const key = canon(cyc);
        if (!seen.has(key)) { seen.add(key); cycles.push(cyc); }
      }
    }
    stack.pop(); onStack.delete(n);
  }
  for (const id of nodeIds) if (!visited.has(id)) dfs(id);
  return cycles.slice(0, 20);
}

function runTreeSitterExtract(dir) {
  const engine = path.join(__dirname, '..', 'parsers', 'tree-sitter', 'extract.js');
  if (!fs.existsSync(path.join(path.dirname(engine), 'node_modules'))) {
    console.error('codequest: the tree-sitter engine needs its dependencies:\n' +
      '  cd codequest/parsers/tree-sitter && npm install   (try --legacy-peer-deps on conflict)');
    process.exit(2);
  }
  const out = execFileSync(process.execPath, [engine, dir],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return new Map(JSON.parse(out).map(e => [e.rel, e]));
}

module.exports = { VERSION, buildGraph, fmtSize, findCycles, runTreeSitterExtract, fileKind, resolveImport, loadAliases, guessLayer, detectEntry, isTestFile, walk };