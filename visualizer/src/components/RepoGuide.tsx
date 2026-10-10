import { useState } from 'react';
import type { CodeQuestGraph, RepoIntel, IntelTable } from '../types';
import { shortName } from '../types';
import { describeBusiness, type Proficiency } from '../lib/narrate';

type Prof = Proficiency;

const TABS = [
  { id: 'run', label: '🚀 Run it' },
  { id: 'flow', label: '🔀 App flow' },
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

function TableCard({ t }: { t: IntelTable }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="guide-table">
      <button className="guide-table-head" onClick={() => setOpen((o) => !o)}>
        <span className="guide-table-name">🗂 {t.name}</span>
        <span className="guide-table-meta">
          {t.columns.length} columns · {t.orm} · {shortName(t.source)}
        </span>
        <span className="guide-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="guide-cols">
          {t.columns.map((c) => (
            <div className="guide-col" key={c.name}>
              <code>{c.name}</code>
              <span>{c.type}</span>
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

export default function RepoGuide({
  graph,
  prof,
  onClose,
  onOpenFile,
}: {
  graph: CodeQuestGraph;
  prof: Prof;
  onClose: () => void;
  onOpenFile: (id: string) => void;
}) {
  const intel: RepoIntel | undefined = graph.intel;
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('run');
  const [copied, setCopied] = useState(false);

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
                        <TableCard key={`${t.orm}:${t.name}`} t={t} />
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
      </div>
    </div>
  );
}
