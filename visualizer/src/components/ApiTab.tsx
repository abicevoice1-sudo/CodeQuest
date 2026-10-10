import { useMemo, useState } from 'react';
import type { CodeQuestGraph } from '../types';
import { shortName } from '../types';
import { findAllEndpoints, explainEndpoint, type ApiEndpoint } from '../lib/api';
import type { Proficiency } from '../lib/narrate';

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#a78bfa',
  DELETE: '#ef4444',
  ALL: '#94a3b8',
  '?': '#94a3b8',
};

function getEmbeddedSource(id: string, graph: CodeQuestGraph): string | undefined {
  // In the static export, sources are embedded. Served mode: skip (graph-only fast path).
  const files = (window as unknown as { __CODEQUEST_FILES__?: Record<string, string> }).__CODEQUEST_FILES__;
  if (!files) return undefined;
  const mod = graph.modules.find((m) => m.id === id);
  return mod ? files[mod.path] : undefined;
}

function EndpointCard({
  e,
  graph,
  prof,
  onOpenFile,
  expanded,
  onToggle,
}: {
  e: ApiEndpoint;
  graph: CodeQuestGraph;
  prof: Proficiency;
  onOpenFile: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const connected = useMemo(() => {
    const upstream = graph.edges.filter((x) => x.from === e.fileId).map((x) => x.to);
    const downstream = graph.edges.filter((x) => x.to === e.fileId).map((x) => x.from);
    return {
      upstream: [...new Set(upstream)],
      downstream: [...new Set(downstream)],
    };
  }, [e.fileId, graph]);

  const business = prof === 'non-technical' || prof === 'beginner';
  const color = METHOD_COLORS[e.method.split(',')[0].trim()] || '#94a3b8';

  return (
    <div className={`api-card${expanded ? ' open' : ''}`}>
      <button className="api-head" onClick={onToggle}>
        <span className="api-method" style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
          {e.method}
        </span>
        <code className="api-path">{e.path}</code>
        <span className="api-chevron">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="api-body">
          <p className="api-use">{explainEndpoint(e)}</p>
          {e.summary && <p className="api-doc">📝 {e.summary}</p>}
          <div className="api-meta">
            <span className="api-framework">{e.framework === 'next-app' ? 'Next.js App Router' : e.framework === 'next-pages' ? 'Next.js Pages Router' : e.framework}</span>
            <button className="guide-file" onClick={() => onOpenFile(e.fileId)}>
              📄 {shortName(e.fileId)}
            </button>
          </div>
          {(connected.upstream.length > 0 || connected.downstream.length > 0) && (
            <div className="api-connected">
              {connected.downstream.length > 0 && (
                <div className="api-conn-row">
                  <span className="api-conn-label">
                    {business ? 'Used by' : 'Imported by'} ({connected.downstream.length})
                  </span>
                  <div className="api-conn-files">
                    {connected.downstream.slice(0, 6).map((id) => (
                      <button key={id} className="guide-file small" onClick={() => onOpenFile(id)}>
                        {shortName(id)}
                      </button>
                    ))}
                    {connected.downstream.length > 6 && (
                      <span className="api-more">+{connected.downstream.length - 6} more</span>
                    )}
                  </div>
                </div>
              )}
              {connected.upstream.length > 0 && (
                <div className="api-conn-row">
                  <span className="api-conn-label">
                    {business ? 'Needs these files' : 'Imports'} ({connected.upstream.length})
                  </span>
                  <div className="api-conn-files">
                    {connected.upstream.slice(0, 6).map((id) => (
                      <button key={id} className="guide-file small" onClick={() => onOpenFile(id)}>
                        {shortName(id)}
                      </button>
                    ))}
                    {connected.upstream.length > 6 && (
                      <span className="api-more">+{connected.upstream.length - 6} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ApiTab({
  graph,
  prof,
  onOpenFile,
}: {
  graph: CodeQuestGraph;
  prof: Proficiency;
  onOpenFile: (id: string) => void;
}) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const endpoints = useMemo(
    () => findAllEndpoints(graph, (id) => getEmbeddedSource(id, graph)),
    [graph]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter(
      (e) => e.path.toLowerCase().includes(q) || e.method.toLowerCase().includes(q)
    );
  }, [endpoints, filter]);

  const business = prof === 'non-technical' || prof === 'beginner';

  if (!endpoints.length) {
    return (
      <section>
        <p className="guide-empty">
          {business
            ? 'No API endpoints detected — this app might not have a web API, or it uses a framework CodeQuest doesn\u2019t recognize yet.'
            : 'No API endpoints detected (checked Next.js App/Pages Router and Express-style routes).'}
        </p>
      </section>
    );
  }

  return (
    <section>
      <p className="guide-lede">
        {business
          ? `Every way the outside world can talk to this app — ${endpoints.length} door${endpoints.length === 1 ? '' : 's'}. Click one to see what it does and what it touches.`
          : `${endpoints.length} endpoint${endpoints.length === 1 ? '' : 's'} detected. Click to expand.`}
      </p>
      {endpoints.length > 6 && (
        <input
          className="api-filter"
          placeholder="Filter endpoints…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      <div className="api-list">
        {filtered.map((e) => {
          const key = `${e.method}:${e.path}`;
          return (
            <EndpointCard
              key={key}
              e={e}
              graph={graph}
              prof={prof}
              onOpenFile={onOpenFile}
              expanded={openPath === key}
              onToggle={() => setOpenPath(openPath === key ? null : key)}
            />
          );
        })}
      </div>
      {!filtered.length && (
        <p className="guide-empty">No endpoints match “{filter}”.</p>
      )}
    </section>
  );
}
