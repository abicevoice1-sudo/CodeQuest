'use strict';
/**
 * CodeQuest repo-intel test suite — node:test, zero dependencies.
 * Covers: runbook (how to run), database detection, schema extraction
 * (Prisma / SQL / Mongoose / SQLAlchemy / Django), app flow, edge names.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FIX = path.join(ROOT, 'examples', 'intel-app');
const { buildGraph } = require('../lib/scan');
const intel = require('../lib/intel');
const P = intel.cleanForTest;

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cq-intel-'));
}
function cpdir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) cpdir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function build() {
  const dir = tmp();
  cpdir(FIX, dir);
  return buildGraph(dir, null);
}

// ------------------------------------------------------------- runbook ---

test('runbook: install + run steps from package.json scripts', () => {
  const g = build();
  const cmds = g.intel.runbook.steps.map((s) => s.command);
  assert.ok(cmds.includes('npm install'), 'has npm install');
  assert.ok(cmds.includes('npm run dev'), 'has npm run dev');
  assert.equal(g.intel.runbook.packageManager, 'npm');
});

test('runbook: port detected from PORT fallback', () => {
  const g = build();
  assert.equal(g.intel.runbook.port, 3000);
});

test('runbook: README quickstart extracted', () => {
  const g = build();
  assert.ok(g.intel.runbook.quickstart, 'quickstart found');
  assert.match(g.intel.runbook.quickstart.heading, /getting started/i);
});

// ------------------------------------------------------------ database ---

test('database: PostgreSQL detected via dependency + import', () => {
  const g = build();
  const pg = g.intel.database.engines.find((e) => e.engine === 'PostgreSQL');
  assert.ok(pg, 'PostgreSQL detected');
  assert.ok(pg.via.includes('package.json'), 'via package.json');
  assert.ok(pg.via.some((f) => f.endsWith('db/users.js')), 'via db/users.js');
});

test('database: env var name captured without value', () => {
  const g = build();
  const ev = g.intel.database.envVars.find((e) => e.name === 'DATABASE_URL');
  assert.ok(ev, 'DATABASE_URL found');
  assert.ok(!('value' in ev), 'no secret value stored');
  assert.match(ev.file, /db\/users\.js$/);
});

// -------------------------------------------------------------- schema ---

test('schema: Prisma model parsed to table + columns', () => {
  const g = build();
  const t = g.intel.schema.tables.find((x) => x.name === 'User');
  assert.ok(t, 'User table found');
  const cols = Object.fromEntries(t.columns.map((c) => [c.name, c.type]));
  assert.equal(cols.id, 'Int');
  assert.equal(cols.email, 'String');
  assert.equal(cols.name, 'String?');
});

test('schema: SQL CREATE TABLE parsed', () => {
  const g = build();
  const t = g.intel.schema.tables.find((x) => x.name === 'orders');
  assert.ok(t, 'orders table found');
  const cols = Object.fromEntries(t.columns.map((c) => [c.name, c.type]));
  assert.equal(cols.id, 'SERIAL');
  assert.equal(cols.user_id, 'INTEGER');
  assert.match(cols.total, /DECIMAL/i);
});

test('schema: Mongoose schema parsed', () => {
  const ts = P.parseMongoose(`
    const userSchema = new Schema({ name: String, age: { type: Number, required: true } });
    const User = mongoose.model('User', userSchema);
  `, 'models.js');
  assert.equal(ts.length, 1);
  assert.equal(ts[0].name, 'User');
  const cols = Object.fromEntries(ts[0].columns.map((c) => [c.name, c.type]));
  assert.equal(cols.name, 'String');
  assert.equal(cols.age, 'Number');
});

test('schema: SQLAlchemy models parsed', () => {
  const ts = P.parseSqlAlchemy(`
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String(120), unique=True)
  `, 'models.py');
  assert.equal(ts.length, 1);
  assert.equal(ts[0].name, 'users');
  const cols = Object.fromEntries(ts[0].columns.map((c) => [c.name, c.type]));
  assert.equal(cols.id, 'Integer');
  assert.equal(cols.email, 'String');
});

test('schema: Django models parsed', () => {
  const ts = P.parseDjango(`
class Order(models.Model):
    total = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.CharField(max_length=200)
  `, 'models.py');
  assert.equal(ts.length, 1);
  const cols = Object.fromEntries(ts[0].columns.map((c) => [c.name, c.type]));
  assert.equal(cols.total, 'DecimalField');
  assert.equal(cols.note, 'CharField');
});

// ---------------------------------------------------------------- flow ---

test('flow: primary entry + BFS steps follow dependency direction', () => {
  const g = build();
  const flow = g.intel.flow;
  assert.ok(flow, 'flow exists');
  assert.ok(flow.primaryEntry, 'primary entry found');
  assert.ok(flow.steps.length > 0, 'has steps');
  // every step's "via" is the file that pulled it in
  for (const s of flow.steps) {
    assert.ok(s.via, 'step has via');
    assert.ok(s.depth >= 1, 'depth >= 1');
  }
});

// ----------------------------------------------------------- edge names ---

test('edges carry imported symbol names for why-explanations', () => {
  const g = build();
  const e = g.edges.find((x) => x.from === 'routes.js' && x.to === 'db/users.js');
  assert.ok(e, 'edge exists');
  assert.deepEqual(e.names, ['getUser']);
});
