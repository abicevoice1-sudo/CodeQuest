import { useState } from 'react';
import type { CodeQuestGraph, RepoIntel, IntelTable } from '../types';
import { shortName } from '../types';
import { describeBusiness, type Proficiency } from '../lib/narrate';
import { describeColumn } from '../lib/columns';

type Prof = Proficiency;

const TABS = [
  { id: 'run', label: '🚀 Run it' },
  { id: 'flow', label: '🔀 App flow' },
  { id: 'arch', label: '🏛 Architecture' },
  { id: 'db', label: '🗄️ Database' },
  { id: 'links', label: '🔗 Why connected' },
] as const;

function tabLabel(id: string, prof: Prof): string {
  if (prof === 'non-technical') {
    if (id === 'flow') return '💼 Business flow';
    if (id === 'links') return '🔗 Why it matters';
    if (id === 'run') return '🚀 Launch it';
  }
  return TABS.find((t) => t.id === id)?.label || id;
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="guide-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
    >
      {ok ? '✓' : '⧉'}
    </button>
  );
}

function TableCard({ t, prof }: { t: IntelTable; prof: Prof }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="guide-table">
      <button className="guide-table-head" onClick={() => setOpen((o) => !o)}>
        <span className="guide-table-name">🗂 {t.name}</span>
        <span className="guide-table-meta">
          {t.columns.length} columns · {t.orm} · {shortName(t.source)}
          {t.orm === 'live' && <span className="guide-live">● live</span>}
        </span>
        <span className="guide-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="guide-cols">
          {t.columns.map((c) => (
            <div className="guide-col" key={c.name}>
              <div className="guide-col-head">
                <code>{c.name}</code>
                <span>{c.type}</span>
              </div>
              <p className="guide-col-why">{describeColumn(c.name, c.type, t.name, prof)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function teacherWhy(from: string, to: string, names: string[], prof: Prof): string {
  const f = shortName(from);
  const t = shortName(to);
  const what = names.length ? ` \`${names.join('`, `')}\`` : '';
  if (prof === 'beginner') {
    return names.length
      ? `${f} borrows${what} from ${t} — like asking a neighbor for a tool instead of building it yourself. That's why the line connects them.`
      : `${f} reaches into ${t} to use something inside it. That's why the line connects them.`;
  }
  if (prof === 'senior' || prof === 'lead') {
    return `${f} → ${t}${what ? ` (${names.join(', ')})` : ''}: direct dependency.`;
  }
  return names.length
    ? `${f} imports${what} from ${t} — it needs ${names.length === 1 ? 'that' : 'those'} to do its job.`
    : `${f} depends on ${t}.`;
}

function businessWhy(from: string, role: { capability: string; why: string }): string {
  const f = shortName(from);
  return `${f} needs ${role.capability} — ${role.why}. That's the business reason they're connected.`;
}

function flowIntro(entry: string, prof: Prof): string {
  const e = shortName(entry);
  if (prof === 'non-technical')
    return `Think of the app as a business opening for the day. It starts at ${e} — the front door — and each step below is a part of the business waking up and getting ready to serve customers. Tap any step to see why the business needs it.`;
  if (prof === 'beginner')
    return `Every app has a front door — the file that wakes up first. Here it's ${e}. Follow the steps below in order and you'll see exactly how the app comes alive, one file handing work to the next.`;
  if (prof === 'senior' || prof === 'lead')
    return `Execution entry: ${e}. BFS over the dependency graph, depth-capped.`;
  return `The app starts at ${e}. Each step is a file it pulls in, directly or through another file — read top to bottom for the standard flow.`;
}

const LAYER_ORDER = ['entry', 'app', 'ui component', 'domain', 'service', 'api route', 'data access', 'infra', 'util', 'test', 'config'];

function layerRank(l: string): number {
  const i = LAYER_ORDER.findIndex((x) => l.toLowerCase().includes(x));
  return i === -1 ? 99 : i;
}

function ArchitectureTab({
  graph,
  prof,
  onOpenFile,
}: {
  graph: CodeQuestGraph;
  prof: Prof;
  onOpenFile: (id: string) => void;
}) {
  const byLayer = new Map<string, { id: string; fanIn: number }[]>();
  for (const m of graph.modules) {
    if (m.kind !== 'code') continue;
    const l = m.layer || 'other';
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push({ id: m.id, fanIn: m.fanIn });
  }
  const layers = [...byLayer.entries()]
    .map(([name, mods]) => ({
      name,
      count: mods.length,
      top: mods.sort((a, b) => b.fanIn - a.fanIn).slice(0, 3),
    }))
    .sort((a, b) => layerRank(a.name) - layerRank(b.name));

  const pipe = graph.intel?.flow?.pipeline || [];
  const outOf = (l: string) => pipe.filter((p) => p.from === l).sort((a, b) => b.count - a.count).slice(0, 3);
  const entries = graph.modules.filter((m) => m.isEntry && m.kind === 'code').slice(0, 6);

  return (
    <section>
      <p className="guide-lede">
        {prof === 'non-technical'
          ? 'How the app is organized — each box is a department, and the arrows show which departments rely on which.'
          : prof === 'beginner'
            ? 'The codebase is organized into layers — groups of files with the same job. Arrows show which layers use which.'
            : 'Layer map with inter-layer dependency counts. Click a file to inspect it.'}
      </p>
      {entries.length > 0 && (
        <div className="guide-arch-entries">
          <span className="guide-arch-label">Entry points</span>
          {entries.map((e) => (
            <button key={e.id} className="guide-file" onClick={() => onOpenFile(e.id)}>
              ⚡ {shortName(e.id)}
            </button>
          ))}
        </div>
      )}
      <div className="guide-arch">
        {layers.map((l) => (
          <div className="guide-arch-layer" key={l.name}>
            <div className="guide-arch-head">
              <span className="guide-layer">{l.name}</span>
              <span className="guide-count">{l.count} files</span>
            </div>
            {outOf(l.name).length > 0 && (
              <div className="guide-arch-links">
                {outOf(l.name).map((p, i) => (
                  <span key={i} className="guide-arch-link">
                    → {p.count} to <b>{p.to}</b>
                  </span>
                ))}
              </div>
            )}
            <div className="guide-arch-top">
              {l.top.map((t) => (
                <button key={t.id} className="guide-file" onClick={() => onOpenFile(t.id)} title={`${t.fanIn} importers`}>
                  {shortName(t.id)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RepoGuide({
  graph,
  prof,
  serverMode,
  onClose,
  onOpenFile,
}: {
  graph: CodeQuestGraph;
  prof: Prof;
  serverMode: boolean;
  onClose: () => void;
  onOpenFile: (id: string) => void;
}) {
  const intel: RepoIntel | undefined = graph.intel;
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('run');
  const [copied, setCopied] = useState(false);
  // DB live-import state
  const [permAsk, setPermAsk] = useState<null | 'env'>(null);
  const [envMatches, setEnvMatches] = useState<{ key: string; score: number; masked: string }[] | null>(null);
  const [envError, setEnvError] = useState('');
  const [connStr, setConnStr] = useState('');
  const [liveSchema, setLiveSchema] = useState<{ engine: string; tables: { name: string; columns: { name: string; type: string }[] }[] } | null>(null);
  const [liveError, setLiveError] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [showConn, setShowConn] = useState(false);

  const scanEnv = async () => {
    setEnvError('');
    setPermAsk(null);
    if (!serverMode) {
      setEnvError('Live .env reading needs the local server — run `codequest start`. You can still paste values manually below.');
      return;
    }
    try {
      const r = await fetch('/api/env-scan?kind=db');
      const j = await r.json();
      setEnvMatches(j.matches || []);
      if (!(j.matches || []).length) setEnvError('No database variables found in .env — tried fuzzy matching on every key.');
    } catch {
      setEnvError('Could not read .env from the local server.');
    }
  };

  const connectLive = async () => {
    setLiveError('');
    setLiveSchema(null);
    const cs = connStr.trim();
    if (!cs) { setLiveError('Paste a connection string first.'); return; }
    if (!serverMode) { setLiveError('Live database connections need the local server — run `codequest start`.'); return; }
    setLiveLoading(true);
    try {
      const r = await fetch('/api/db-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: cs }),
      });
      const j = await r.json();
      if (j.error) {
        const m = /^driver-missing:(.+)/.exec(j.error);
        setLiveError(m ? `Need the ${m[1]} driver on this machine first.` : j.error);
      } else {
        setLiveSchema(j);
      }
    } catch {
      setLiveError('Could not reach the database. Check the connection string and that the DB is running.');
    } finally {
      setLiveLoading(false);
    }
  };

  if (!intel) {
    return (
      <div className="guide-overlay" onClick={onClose}>
        <div className="guide" onClick={(e) => e.stopPropagation()}>
          <div className="guide-head">
            <h2>📖 App guide</h2>
            <button className="guide-close" onClick={onClose}>✕</button>
          </div>
          <p className="guide-empty">
            This report was generated before the app-guide existed. Re-run{' '}
            <code>codequest export</code> with v1.12+ to get the full briefing.
          </p>
        </div>
      </div>
    );
  }

  const { runbook, database, schema, flow } = intel;
  const repoName = graph.root ? graph.root.split('/').pop() : 'this repo';

  // top connections by target importance
  const modById = new Map(graph.modules.map((m) => [m.id, m]));
  const topLinks = [...graph.edges]
    .filter((e) => (modById.get(e.to)?.fanIn || 0) > 0)
    .sort((a, b) => (modById.get(b.to)?.fanIn || 0) - (modById.get(a.to)?.fanIn || 0))
    .slice(0, 10);

  const copyAll = () => {
    const cmds = runbook.steps.filter((s) => !s.optional).map((s) => s.command).join('\n');
    navigator.clipboard?.writeText(cmds).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide" onClick={(e) => e.stopPropagation()}>
        <div className="guide-head">
          <h2>📖 App guide <span className="guide-repo">{repoName}</span></h2>
          <button className="guide-close" onClick={onClose}>✕</button>
        </div>
        <div className="guide-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {tabLabel(t.id, prof)}
            </button>
          ))}
        </div>

        <div className="guide-body">
          {tab === 'run' && (
            <section>
              <p className="guide-lede">
                {prof === 'non-technical'
                  ? `Here's how to get ${repoName} running, step by step. Each line is a command — hand them to your developer in order, or paste them into a terminal one by one.`
                  : prof === 'beginner'
                    ? `Here's how to get ${repoName} running on your own computer, step by step. Run each command in your terminal, in order.`
                    : prof === 'senior' || prof === 'lead'
                      ? 'Repro commands. Optionals are marked.'
                      : `Get ${repoName} running — commands in order.`}
              </p>
              {runbook.steps.length === 0 && (
                <p className="guide-empty">No run steps detected for this repo.</p>
              )}
              <ol className="guide-steps">
                {runbook.steps.map((s, i) => (
                  <li key={i} className={s.optional ? 'optional' : ''}>
                    <div className="guide-step-title">
                      {i + 1}. {s.title}
                      {s.optional && <span className="guide-opt">optional</span>}
                      {s.source === 'readme' && <span className="guide-src">from README</span>}
                    </div>
                    <div className="guide-cmd">
                      <code>{s.command}</code>
                      <CopyBtn text={s.command} />
                    </div>
                  </li>
                ))}
              </ol>
              <div className="guide-actions">
                <button className="guide-btn" onClick={copyAll}>
                  {copied ? '✓ Copied' : '⧉ Copy all commands'}
                </button>
                {runbook.port && (
                  <span className="guide-port">
                    Then open <code>http://localhost:{runbook.port}</code>
                  </span>
                )}
              </div>
              {runbook.quickstart && (
                <details className="guide-qs">
                  <summary>📄 From the README — “{runbook.quickstart.heading}”</summary>
                  <pre>{runbook.quickstart.lines.join('\n')}</pre>
                </details>
              )}
            </section>
          )}

          {tab === 'flow' && (
            <section>
              {flow ? (
                <>
                  <p className="guide-lede">{flowIntro(flow.primaryEntry, prof)}</p>
                  <ol className="guide-flow">
                    <li className="guide-flow-entry">
                      <button className="guide-file" onClick={() => onOpenFile(flow.primaryEntry)}>
                        {shortName(flow.primaryEntry)}
                      </button>
                      <span className="guide-flow-why">
                        {prof === 'beginner' ? '← the front door: starts first' : '← entry point'}
                      </span>
                    </li>
                    {flow.steps.map((s, i) => (
                      <li key={i} style={{ marginLeft: Math.min(s.depth, 4) * 18 }}>
                        <button className="guide-file" onClick={() => onOpenFile(s.file)}>
                          {shortName(s.file)}
                        </button>
                        <span className="guide-flow-why">
                          {prof === 'non-technical'
                            ? `← ${describeBusiness(s.file, graph).capability}`
                            : prof === 'beginner'
                              ? `← pulled in by ${shortName(s.via || '')}`
                              : `← via ${shortName(s.via || '')}`}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {flow.pipeline.length > 0 && (
                    <>
                      <h3 className="guide-h3">
                        {prof === 'non-technical' ? 'How the parts work together' : 'The pipeline — how layers talk'}
                      </h3>
                      <p className="guide-lede">
                        {prof === 'non-technical'
                          ? 'Each box is a kind of work the business does. The arrows show which kinds rely on which:'
                          : prof === 'beginner'
                            ? 'Think of the app as floors in a building. Work starts at the top and flows down:'
                            : 'Inter-layer dependency counts:'}
                      </p>
                      <div className="guide-pipe">
                        {flow.pipeline.map((p, i) => (
                          <div className="guide-pipe-link" key={i}>
                            <span className="guide-layer">{p.from}</span>
                            <span className="guide-arrow">→ {p.count}</span>
                            <span className="guide-layer">{p.to}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="guide-empty">No clear entry point detected in this repo.</p>
              )}
            </section>
          )}

          {tab === 'arch' && (
            <ArchitectureTab graph={graph} prof={prof} onOpenFile={onOpenFile} />
          )}

          {tab === 'db' && (
            <section>
              {database.engines.length === 0 && schema.tables.length === 0 ? (
                <p className="guide-empty">
                  {prof === 'beginner'
                    ? 'No database detected — this app doesn\'t seem to store data in a database. It might keep everything in memory or in files.'
                    : 'No database usage detected.'}
                </p>
              ) : (
                <>
                  {database.engines.length > 0 && (
                    <>
                      <h3 className="guide-h3">Databases this app talks to</h3>
                      <div className="guide-engines">
                        {database.engines.map((e) => (
                          <div className="guide-engine" key={e.engine}>
                            <div className="guide-engine-name">🗄 {e.engine}</div>
                            <div className="guide-engine-via">
                              via <code>{e.via.slice(0, 3).join(', ')}</code>
                              {e.via.length > 3 && ` +${e.via.length - 3} more`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {database.envVars.length > 0 && (
                    <p className="guide-lede">
                      🔑 Needs {database.envVars.length === 1 ? 'this secret' : 'these secrets'} set:{' '}
                      {database.envVars.map((v) => (
                        <code key={v.name} title={`used in ${v.file}`}>{v.name}</code>
                      )).reduce<React.ReactNode[]>((a, b, i) => (i === 0 ? [b] : [...a, ', ', b]), [])}
                      {' '}— values stay in your <code>.env</code>, never in the report.
                    </p>
                  )}
                  {schema.tables.length > 0 && (
                    <>
                      <h3 className="guide-h3">
                        Tables & columns
                        <span className="guide-count">{schema.tables.length}</span>
                      </h3>
                      <p className="guide-lede">
                        {prof === 'beginner'
                          ? 'A database is made of tables (like spreadsheets). Tap one to see its columns:'
                          : 'Detected data model — tap a table for its columns:'}
                      </p>
                      {schema.tables.map((t) => (
                        <TableCard key={`${t.orm}:${t.name}`} t={t} prof={prof} />
                      ))}
                    </>
                  )}
                  <h3 className="guide-h3">Import from the real database</h3>
                  <p className="guide-lede">
                    Connect to the live database to pull its <b>real</b> tables and columns — not just what the code hints at.
                  </p>
                  <div className="guide-import">
                    <button className="guide-btn" onClick={() => setPermAsk('env')}>
                      📥 Import connection from .env
                    </button>
                    <button className="guide-btn ghost-btn" onClick={() => setShowConn((s) => !s)}>
                      🔌 Connect manually
                    </button>
                  </div>
                  {envError && <p className="guide-err">{envError}</p>}
                  {envMatches && (
                    <div className="guide-envmatches">
                      {envMatches.map((m) => (
                        <div className="guide-envmatch" key={m.key}>
                          <code>{m.key}</code>
                          <span className="guide-masked">{m.masked}</span>
                          <button
                            className="guide-copy"
                            title="Use this value as the connection string"
                            onClick={() => { setConnStr(''); setShowConn(true); }}
                          >
                            Use →
                          </button>
                        </div>
                      ))}
                      <p className="guide-lede" style={{ marginTop: 8 }}>
                        Values stay on this machine — only masked previews are shown. Paste the full value into the connection box below.
                      </p>
                    </div>
                  )}
                  {showConn && (
                    <div className="guide-conn">
                      <input
                        type="password"
                        value={connStr}
                        onChange={(e) => setConnStr(e.target.value)}
                        placeholder="postgres://user:pass@host:5432/db  ·  mysql://…  ·  mongodb://…  ·  /path/to.db"
                      />
                      <button className="guide-btn" onClick={connectLive} disabled={liveLoading}>
                        {liveLoading ? 'Connecting…' : 'Connect & import schema'}
                      </button>
                    </div>
                  )}
                  {liveError && <p className="guide-err">{liveError}</p>}
                  {liveSchema && (
                    <>
                      <h3 className="guide-h3">
                        Live schema — {liveSchema.engine}
                        <span className="guide-count">{liveSchema.tables.length} tables</span>
                        <span className="guide-live">● live</span>
                      </h3>
                      {liveSchema.tables.map((t) => (
                        <TableCard key={'live:' + t.name} t={{ name: t.name, source: 'live database', columns: t.columns, orm: 'live' }} prof={prof} />
                      ))}
                    </>
                  )}
                </>
              )}
            </section>
          )}

          {tab === 'links' && (
            <section>
              <p className="guide-lede">
                {prof === 'non-technical'
                  ? 'Everything in the app exists for a business reason. Here are the most important connections — and why the business needs each one:'
                  : prof === 'beginner'
                    ? 'Files connect because one needs something from the other. Here are the most important connections, and the plain-English reason for each:'
                    : prof === 'senior' || prof === 'lead'
                      ? 'Top dependencies by target fan-in, with imported symbols:'
                      : 'The most important connections — and why each exists:'}
              </p>
              {topLinks.length === 0 && (
                <p className="guide-empty">No connections found.</p>
              )}
              <div className="guide-links">
                {topLinks.map((e, i) => (
                  <div className="guide-link" key={i}>
                    <div className="guide-link-files">
                      <button className="guide-file" onClick={() => onOpenFile(e.from)}>
                        {shortName(e.from)}
                      </button>
                      <span className="guide-arrow">→</span>
                      <button className="guide-file" onClick={() => onOpenFile(e.to)}>
                        {shortName(e.to)}
                      </button>
                    </div>
                    <p className="guide-link-why">
                      {prof === 'non-technical'
                        ? businessWhy(e.from, describeBusiness(e.to, graph))
                        : teacherWhy(e.from, e.to, e.names || [], prof)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        {permAsk === 'env' && (
          <div className="guide-perm-backdrop" onClick={() => setPermAsk(null)}>
            <div className="guide-perm" onClick={(e) => e.stopPropagation()}>
              <h3>🔑 Read your .env file?</h3>
              <p>
                CodeQuest wants to read <code>.env</code> in this repo to find database
                connection details — using fuzzy matching across every variable name.
                Only masked previews are ever shown; secrets never leave this machine.
              </p>
              <div className="guide-perm-actions">
                <button className="ghost-btn guide-btn" onClick={() => setPermAsk(null)}>Cancel</button>
                <button className="guide-btn" onClick={scanEnv}>Allow — scan .env</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
