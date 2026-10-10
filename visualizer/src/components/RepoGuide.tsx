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

function businessWhy(from: string, fromRole: { capability: string; why: string }, to: string, toRole: { capability: string; why: string }): string {
  const f = shortName(from);
  const t = shortName(to);
  return `${f} handles ${fromRole.capability}. It can't do that job without ${t}, which covers ${toRole.capability} — ${toRole.why}.`;
}

function businessStory(graph: CodeQuestGraph): { what: string; parts: { name: string; desc: string }[]; journey: string } {
  const layers = new Set(graph.modules.map((m) => (m.layer || '').toLowerCase()));
  const has = (...ks: string[]) => ks.some((k) => [...layers].some((l) => l.includes(k)));
  const count = (...ks: string[]) =>
    graph.modules.filter((m) => ks.some((k) => (m.layer || '').toLowerCase().includes(k)) && m.kind === 'code').length;

  const entry = graph.intel?.flow?.primaryEntry || '';
  const en = entry.toLowerCase();
  const what = /cli|command/.test(en)
    ? 'a command-line tool — you type a command, it does the work, and reports back'
    : /serve|server|app\.|index/.test(en)
      ? 'an app that runs continuously, waiting for you (or other software) to ask it to do things'
      : 'a software app — a set of files that work together to do a job';

  const parts: { name: string; desc: string }[] = [];
  if (has('ui', 'component', 'page', 'view')) {
    const c = count('ui', 'component', 'page', 'view');
    parts.push({ name: '🖥️ What Customers See', desc: `The screens and buttons — ${c} piece${c === 1 ? '' : 's'} that make up the visible interface.` });
  }
  if (has('api', 'route', 'controller', 'handler')) {
    const c = count('api', 'route', 'controller', 'handler');
    parts.push({ name: '🚪 Front Doors', desc: `Where requests come in — ${c} entry point${c === 1 ? '' : 's'} that receive asks from users or other apps.` });
  }
  if (has('service', 'domain', 'logic', 'core')) {
    const c = count('service', 'domain', 'logic', 'core');
    parts.push({ name: '⚙️ The Work', desc: `Where the actual job gets done — ${c} piece${c === 1 ? '' : 's'} of business logic that do the thinking.` });
  }
  if (has('data', 'db', 'database', 'repo', 'store', 'model')) {
    const c = count('data', 'db', 'database', 'repo', 'store', 'model');
    parts.push({ name: '🗄️ Business Memory', desc: `Where information is kept — ${c} piece${c === 1 ? '' : 's'} that read and write the app's records.` });
  }
  if (parts.length === 0) {
    parts.push({ name: '📦 The pieces', desc: `${graph.modules.filter((m) => m.kind === 'code').length} code files working together.` });
  }

  const tables: { name: string }[] = graph.intel?.schema?.tables || [];
  const journey =
    tables.length > 0
      ? `You ask for something → the front door receives it → the work gets done → the memory (${tables.slice(0, 3).map((t: { name: string }) => t.name).join(', ')}${tables.length > 3 ? ', and more' : ''}) is updated → you get your answer.`
      : `You ask for something → the front door receives it → the work gets done → you get your answer.`;

  return { what, parts, journey };
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
  const isFixture = (id: string) => /fixture|example|mock|__tests__|[/\\]test[/\\]|\.test\./i.test(id);
  for (const m of graph.modules) {
    if (m.kind !== 'code') continue;
    if (prof === 'non-technical' && (m.isTest || isFixture(m.id))) continue;
    const l = m.layer || 'other';
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push({ id: m.id, fanIn: m.fanIn });
  }
  // Translate layer jargon → business departments.
  const bizLayer = (l: string): string => {
    const x = l.toLowerCase();
    if (x.includes('entry')) return '🚪 Front Doors';
    if (x.includes('ui') || x.includes('component') || x.includes('page') || x.includes('view')) return '🖥️ What Customers See';
    if (x.includes('api') || x.includes('route') || x.includes('controller')) return '📬 Requests In';
    if (x.includes('service') || x.includes('domain') || x.includes('logic') || x.includes('core')) return '⚙️ The Work';
    if (x.includes('data') || x.includes('db') || x.includes('database') || x.includes('repo') || x.includes('model')) return '🗄️ Business Memory';
    if (x.includes('infra') || x.includes('util') || x.includes('config')) return '🔧 Behind the Scenes';
    if (x.includes('test')) return '🧪 Safety Checks';
    return `📦 ${l}`;
  };

  const layers = [...byLayer.entries()]
    .map(([name, mods]) => ({
      name,
      bizName: prof === 'non-technical' ? bizLayer(name) : name,
      count: mods.length,
      top: mods.sort((a, b) => b.fanIn - a.fanIn).slice(0, 3),
      mods,
    }))
    .sort((a, b) => layerRank(a.name) - layerRank(b.name));

  // Business viewers: merge layers that map to the same department.
  const displayLayers = prof === 'non-technical'
    ? (() => {
        const merged = new Map<string, { name: string; bizName: string; count: number; top: { id: string; fanIn: number }[]; rank: number }>();
        for (const l of layers) {
          const ex = merged.get(l.bizName);
          if (ex) {
            ex.count += l.count;
            ex.top = [...ex.top, ...l.mods].sort((a, b) => b.fanIn - a.fanIn).slice(0, 3);
            ex.rank = Math.min(ex.rank, layerRank(l.name));
          } else {
            merged.set(l.bizName, { name: l.name, bizName: l.bizName, count: l.count, top: l.top, rank: layerRank(l.name) });
          }
        }
        return [...merged.values()].sort((a, b) => a.rank - b.rank);
      })()
    : layers;

  const pipe = graph.intel?.flow?.pipeline || [];
  const outOf = (l: string) => pipe.filter((p) => p.from === l).sort((a, b) => b.count - a.count).slice(0, 3);
  // Business viewers: hide test/fixture entry points — they confuse the story.
  const entries = graph.modules
    .filter((m) => m.isEntry && m.kind === 'code' && !m.isTest && !/fixture|example|mock|__tests__|test/i.test(m.id))
    .slice(0, 6);

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
        {displayLayers
          .filter((l) => prof !== 'non-technical' || !l.name.toLowerCase().includes('test'))
          .map((l) => (
          <div className="guide-arch-layer" key={l.bizName || l.name}>
            <div className="guide-arch-head">
              <span className="guide-layer">{l.bizName || l.name}</span>
              <span className="guide-count">
                {prof === 'non-technical' ? `${l.count} piece${l.count === 1 ? '' : 's'}` : `${l.count} files`}
              </span>
            </div>
            {prof !== 'non-technical' && outOf(l.name).length > 0 && (
              <div className="guide-arch-links">
                {outOf(l.name).map((p, i) => (
                  <span key={i} className="guide-arch-link">
                    → {p.count} to <b>{p.to}</b>
                  </span>
                ))}
              </div>
            )}
            {prof === 'non-technical' && outOf(l.name).length > 0 && (() => {
              const uniq = [...new Set(outOf(l.name).map((p) => bizLayer(p.to)))].filter((b) => b !== (l.bizName || l.name));
              if (uniq.length === 0) return null;
              return (
                <div className="guide-arch-links">
                  <span className="guide-arch-link biz">
                    Works with {uniq.join(', ')}
                  </span>
                </div>
              );
            })()}
            <div className="guide-arch-top">
              {l.top.map((t) => (
                <button key={t.id} className="guide-file" onClick={() => onOpenFile(t.id)} title={prof === 'non-technical' ? describeBusiness(t.id, graph).capability : `${t.fanIn} importers`}>
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

  // Business viewers: skip plumbing (types/utils/constants) — show connections
  // between parts that actually do business work.
  const PLUMBING_RE = /^(types?|utils?|constants?|helpers?|config|common)\./i;
  const topBusinessLinks = [...graph.edges]
    .filter((e) => {
      const from = modById.get(e.from);
      const to = modById.get(e.to);
      if (!to || (to.fanIn || 0) === 0) return false;
      if (PLUMBING_RE.test(shortName(e.to))) return false;
      if (to.isTest || from?.isTest) return false;
      if (/fixture|example|mock|__tests__/i.test(e.from) || /fixture|example|mock|__tests__/i.test(e.to)) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = modById.get(a.to)!;
      const tb = modById.get(b.to)!;
      // Prefer service/domain/entry targets — the parts that do business work.
      const score = (m: { layer?: string; isEntry?: boolean; fanIn?: number }) => {
        const l = (m.layer || '').toLowerCase();
        let s = m.fanIn || 0;
        if (m.isEntry) s += 50;
        if (l.includes('service') || l.includes('domain')) s += 30;
        if (l.includes('api') || l.includes('route')) s += 15;
        return s;
      };
      return score(tb) - score(ta);
    })
    .slice(0, 6);

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
                  {flow.pipeline.length > 0 && prof !== 'non-technical' && (
                    <>
                      <h3 className="guide-h3">
                        {prof === 'beginner' ? 'The pipeline — how layers talk' : 'Inter-layer dependency counts'}
                      </h3>
                      <p className="guide-lede">
                        {prof === 'beginner'
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
                  {prof === 'non-technical' && (() => {
                    const story = businessStory(graph);
                    return (
                      <>
                        <h3 className="guide-h3">What this app is</h3>
                        <p className="guide-lede">This repo is {story.what}.</p>
                        <h3 className="guide-h3">The parts of the business</h3>
                        <div className="guide-story-parts">
                          {story.parts.map((p, i) => (
                            <div className="guide-story-part" key={i}>
                              <span className="guide-story-name">{p.name}</span>
                              <span className="guide-story-desc">{p.desc}</span>
                            </div>
                          ))}
                        </div>
                        <h3 className="guide-h3">Follow one request</h3>
                        <p className="guide-lede">{story.journey}</p>
                      </>
                    );
                  })()}
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
                {(prof === 'non-technical' ? topBusinessLinks : topLinks).map((e, i) => (
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
                        ? businessWhy(e.from, describeBusiness(e.from, graph), e.to, describeBusiness(e.to, graph))
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
