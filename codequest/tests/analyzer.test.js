'use strict';
/**
 * CodeQuest analyzer test suite — node:test, zero dependencies.
 * Run:  node --test codequest/tests/
 * Asserts deterministic behavior on the example fixtures. If any assertion
 * fails, the analyzer's contract (.codequest/graph.json) is broken.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, execSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const BIN = path.join(ROOT, 'codequest', 'bin', 'codequest');
const FIX_APP = path.join(ROOT, 'examples', 'sample-app');
const FIX_EDGE = path.join(ROOT, 'examples', 'edge-cases');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cq-test-'));
}
function cpdir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) cpdir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function scan(dir) {
  execFileSync(process.execPath, [BIN, 'scan', dir], { stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(path.join(dir, '.codequest', 'graph.json'), 'utf8'));
}
function edges(g) {
  return new Set(g.edges.map(e => `${e.from}→${e.to}`));
}

// ---------------------------------------------------------- sample app ---

test('sample-app: module and edge counts', () => {
  const dir = tmp(); cpdir(FIX_APP, dir);
  const g = scan(dir);
  assert.equal(g.modules.length, 11);
  // 12: 10 JS edges + 2 python relative imports (seed.py → seed_data, logger)
  assert.equal(g.edges.length, 12);
});

test('sample-app: entry points detected', () => {
  const dir = tmp(); cpdir(FIX_APP, dir);
  const g = scan(dir);
  const entries = g.modules.filter(m => m.isEntry).map(m => m.id).sort();
  assert.deepEqual(entries, ['src/index.js', 'tools/seed.py']);
});

test('sample-app: layers and risk', () => {
  const dir = tmp(); cpdir(FIX_APP, dir);
  const g = scan(dir);
  const byId = new Map(g.modules.map(m => [m.id, m]));
  assert.equal(byId.get('src/utils/logger.js').layer, 'Shared Utility');
  assert.equal(byId.get('src/utils/logger.js').risk, 'HIGH'); // fan-in 4
  assert.equal(byId.get('src/db/index.js').layer, 'Data Access');
  assert.equal(byId.get('src/services/orderService.test.js').layer, 'Test');
  assert.equal(byId.get('src/services/orderService.test.js').risk, 'LOW');
});

test('sample-app: blast radius of logger', () => {
  const dir = tmp(); cpdir(FIX_APP, dir);
  scan(dir);
  const out = JSON.parse(execFileSync(process.execPath,
    [BIN, 'blast-radius', 'src/utils/logger.js', dir, '--json'], { encoding: 'utf8' }));
  assert.equal(out.risk, 'HIGH');
  assert.equal(out.downstream[0].modules.length, 4); // 1st degree
  assert.ok(out.downstream[1].modules.includes('src/routes/orders.js')); // 2nd degree
  assert.ok(out.affectedTests.includes('src/services/orderService.test.js'));
});

test('sample-app: story trace from index', () => {
  const dir = tmp(); cpdir(FIX_APP, dir);
  scan(dir);
  const out = JSON.parse(execFileSync(process.execPath,
    [BIN, 'story', 'src/index.js', dir, '--json'], { encoding: 'utf8' }));
  assert.equal(out.steps.length, 7);
  assert.equal(out.steps[0].file, 'src/index.js');
  assert.ok(out.steps.some(s => s.file === 'src/services/orderService.js'));
});

// ---------------------------------------------------------- edge cases ---

test('edge-cases: tsconfig path aliases resolve', () => {
  const dir = tmp(); cpdir(FIX_EDGE, dir);
  const g = scan(dir);
  const e = edges(g);
  assert.ok(e.has('src/index.ts→src/services/userService.ts'), 'alias @/services/*');
  assert.ok(e.has('src/index.ts→src/types.ts'), 'alias @/* + import type');
});

test('edge-cases: barrel re-exports create edges', () => {
  const dir = tmp(); cpdir(FIX_EDGE, dir);
  const g = scan(dir);
  const e = edges(g);
  assert.ok(e.has('src/barrel.ts→src/services/userService.ts'), 'export * from');
  assert.ok(e.has('src/barrel.ts→src/util.ts'), 'export { x } from');
});

test('edge-cases: python relative imports resolve', () => {
  const dir = tmp(); cpdir(FIX_EDGE, dir);
  const g = scan(dir);
  const e = edges(g);
  assert.ok(e.has('pkg/cli.py→pkg/helpers.py'), 'from .helpers import');
  assert.ok(e.has('pkg/cli.py→pkg/core.py'), 'from . import core');
});

test('edge-cases: only genuine cycles reported', () => {
  const dir = tmp(); cpdir(FIX_EDGE, dir);
  const g = scan(dir);
  assert.equal(g.cycles.length, 1);
  assert.deepEqual(g.cycles[0], ['src/a.ts', 'src/b.ts', 'src/a.ts']);
});

test('edge-cases: unresolved imports never fabricated', () => {
  const dir = tmp(); cpdir(FIX_EDGE, dir);
  fs.writeFileSync(path.join(dir, 'src', 'broken.ts'),
    "import { x } from './does-not-exist';\nexport const y = 1;\n");
  const g = scan(dir);
  const mod = g.modules.find(m => m.id === 'src/broken.ts');
  assert.ok(mod);
  assert.equal(mod.imports.filter(i => i.resolved).length, 0);
  assert.ok(!edges(g).has('src/broken.ts→src/index.ts'), 'no fallback fabrication');
});

// ---------------------------------------------------------------- diff ---

test('diff: detects drift and fails on new CRITICAL', () => {
  const oldD = tmp(); cpdir(FIX_EDGE, oldD); scan(oldD);
  const newD = tmp(); cpdir(FIX_EDGE, newD);
  fs.mkdirSync(path.join(newD, 'src', 'hub'));
  fs.writeFileSync(path.join(newD, 'src', 'hub', 'index.ts'), 'export const hub = 1;\n');
  for (let i = 0; i < 8; i++) {
    fs.writeFileSync(path.join(newD, 'src', `c${i}.ts`),
      `import { hub } from './hub';\nexport const c${i} = hub;\n`);
  }
  scan(newD);
  let code = 0, json = null;
  try {
    const out = execFileSync(process.execPath, [BIN, 'diff', oldD, newD, '--json'],
      { encoding: 'utf8' });
    json = JSON.parse(out);
  } catch (e) { code = e.status; json = JSON.parse(e.stdout); }
  assert.equal(code, 1, 'exits 1 on new CRITICAL');
  assert.ok(json.newCritical.some(m => m.module === 'src/hub/index.ts'));
  assert.equal(json.addedModules.length, 9);
});

test('diff: clean tree passes', () => {
  const oldD = tmp(); cpdir(FIX_EDGE, oldD); scan(oldD);
  const newD = tmp(); cpdir(FIX_EDGE, newD); scan(newD);
  const out = execFileSync(process.execPath, [BIN, 'diff', oldD, newD, '--json'],
    { encoding: 'utf8' });
  const json = JSON.parse(out);
  assert.equal(json.failures.length, 0);
  assert.equal(json.addedModules.length, 0);
});

test('frameworks: entry points detected across 7 frameworks', () => {
  const dir = tmp(); cpdir(FIX_EDGE, dir);
  const g = scan(dir);
  const entries = g.modules.filter(m => m.isEntry).map(m => m.id);
  for (const want of ['api/urls.py', 'web/routes.py', 'src/router.tsx',
      'app/page.tsx', 'OrderController.java', 'web.php', 'pkg/cli.py']) {
    assert.ok(entries.includes(want), `entry: ${want}`);
  }
  const byId = new Map(g.modules.map(m => [m.id, m]));
  assert.equal(byId.get('api/urls.py').layer, 'Entry'); // entry outranks route
  assert.equal(byId.get('api/views.py').layer, 'API Route');
});

test('assets: configs, docs, images, data inventoried and shown', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'app.json'), '{"name":"x","version":"1"}');
  fs.writeFileSync(path.join(dir, 'README.md'), '# T\n\n## A\n');
  fs.writeFileSync(path.join(dir, 'logo.png'), 'PNGDATA');
  fs.writeFileSync(path.join(dir, '.env'), 'K=v\n');
  fs.writeFileSync(path.join(dir, 'q.sql'), 'SELECT 1;\n');
  const g = scan(dir);
  const byId = new Map(g.modules.map(m => [m.id, m]));
  assert.equal(byId.get('app.json').kind, 'config');
  assert.equal(byId.get('app.json').summary, 'keys: name, version');
  assert.equal(byId.get('README.md').kind, 'doc');
  assert.ok(byId.get('README.md').summary.includes('A'));
  assert.equal(byId.get('logo.png').kind, 'image');
  assert.equal(byId.get('.env').layer, 'Config');
  assert.equal(byId.get('q.sql').kind, 'data');
  const map = fs.readFileSync(path.join(dir, '.codequest', 'repo-map.md'), 'utf8');
  assert.ok(map.includes('Assets, configs & docs (5)'));
});

test('assets: js importing a json config creates an edge', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'c.json'), '{"n":1}');
  fs.writeFileSync(path.join(dir, 'a.js'), 'const c = require("./c.json");\nmodule.exports = c;\n');
  const g = scan(dir);
  assert.ok(new Set(g.edges.map(e => e.from + '→' + e.to)).has('a.js→c.json'));
});

test('init: writes config; scan picks up audience', () => {
  const dir = tmp();
  execFileSync(process.execPath, [BIN, 'init', dir, '--audience', 'expert', '--business'], { stdio: 'pipe' });
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.codequest', 'config.json'), 'utf8'));
  assert.equal(cfg.audience, 'expert');
  assert.equal(cfg.businessLens, true);
  const g = scan(dir);
  assert.equal(g.audience, 'expert');
  assert.equal(g.businessLens, true);
});

test('setup: detects IDEs/assistants and writes per-IDE config', () => {
  const dir = tmp(), home = tmp(), bin = tmp();
  fs.mkdirSync(path.join(home, '.config', 'Code', 'extensions', 'github.copilot-chat-1.0.0'), { recursive: true });
  for (const n of ['code', 'cursor']) {
    fs.writeFileSync(path.join(bin, n), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  }
  const env = { ...process.env, HOME: home, PATH: bin + ':' + process.env.PATH };
  const out = execFileSync(process.execPath, [BIN, 'setup', dir, '--json'], { encoding: 'utf8', env });
  const rec = JSON.parse(out);
  assert.ok(rec.detected.ides.some(i => i.id === 'vscode'), 'detects vscode');
  assert.ok(rec.detected.ides.some(i => i.id === 'cursor'), 'detects cursor');
  assert.ok(rec.detected.assistants.some(a => a.id === 'copilot'), 'detects copilot');
  assert.ok(fs.existsSync(path.join(dir, '.github', 'muse-instructions.md')));
  assert.ok(fs.existsSync(path.join(dir, '.cursor', 'rules', 'codequest.mdc')));
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')));
  const mcp = JSON.parse(fs.readFileSync(path.join(dir, '.vscode', 'mcp.json'), 'utf8'));
  assert.ok(mcp.servers.codequest, 'mcp server wired');
  assert.ok(fs.existsSync(path.join(dir, '.codequest', 'setup.json')));
});
