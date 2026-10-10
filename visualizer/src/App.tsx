import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeProps,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './index.css';
import { layoutGraph, blastRadius, type CQNodeData } from './layout';
import { RISK_COLORS, LAYER_COLORS, shortName, type CodeQuestGraph, type Risk } from './types';

/* ------------------------------------------------------------------ */
/* Custom node                                                         */
/* ------------------------------------------------------------------ */

function CQNode({ data, selected }: NodeProps<Node<CQNodeData>>) {
  const color = RISK_COLORS[(data.risk as Risk) || 'LOW'];
  return (
    <div
      className={`cq-node${selected ? ' selected' : ''}${data.isTest ? ' test' : ''}`}
      style={{ ['--risk' as string]: color }}
    >
      <Handle type="target" position={Position.Left} className="cq-handle" />
      <div className="cq-node-body">
        <div className="cq-node-title" title={data.path}>
          {data.isEntry && <span className="cq-entry-dot" title="Entry point" />}
          {data.label}
        </div>
        <div className="cq-node-sub">
          <span className="cq-layer" style={{ color: LAYER_COLORS[data.layer] || '#94a3b8' }}>
            {data.layer}
          </span>
          <span className="cq-fans">↑{data.fanIn} ↓{data.fanOut}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="cq-handle" />
    </div>
  );
}

const nodeTypes = { cq: CQNode };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DEGREE_COLORS = ['#f43f5e', '#fb923c', '#facc15', '#a3e635', '#34d399'];

async function readGraphFile(file: File): Promise<CodeQuestGraph> {
  const text = await file.text();
  const g = JSON.parse(text);
  if (!g.modules || !g.edges) throw new Error('not a CodeQuest graph.json');
  return g;
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [graph, setGraph] = useState<CodeQuestGraph | null>(null);
  const [fileName, setFileName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CQNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blast, setBlast] = useState<Map<string, number> | null>(null);
  const [query, setQuery] = useState('');
  const [hideTests, setHideTests] = useState(false);
  const [hideAssets, setHideAssets] = useState(false);
  const [layers, setLayers] = useState<Set<string>>(new Set());
  const [risks, setRisks] = useState<Set<string>>(new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']));
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [counts, setCounts] = useState({ shown: 0, hidden: 0 });
  const flowRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const fileInput = useRef<HTMLInputElement>(null);

  const allLayers = useMemo(
    () => [...new Set((graph?.modules || []).map((m) => m.layer))].sort(),
    [graph],
  );

  useEffect(() => {
    if (allLayers.length && layers.size === 0) setLayers(new Set(allLayers));
  }, [allLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGraph = useCallback((g: CodeQuestGraph, name: string) => {
    setGraph(g);
    setFileName(name);
    setSelectedId(null);
    setBlast(null);
    setError('');
  }, []);

  // Re-layout whenever graph or filters change.
  useEffect(() => {
    if (!graph) return;
    const { nodes: ns, edges: es, counts: c } = layoutGraph(graph, {
      hideTests,
      hideAssets,
      layers: layers.size ? layers : new Set(allLayers),
      risks,
    });
    setNodes(ns);
    setEdges(es);
    setCounts(c);
    setSelectedId(null);
    setBlast(null);
  }, [graph, hideTests, hideAssets, layers, risks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Try injected graph (VS Code extension) → ./graph.json → drop screen.
  useEffect(() => {
    const injected = (window as unknown as { __CODEQUEST_GRAPH__?: CodeQuestGraph }).__CODEQUEST_GRAPH__;
    if (injected && injected.modules) {
      loadGraph(injected, 'workspace');
      return;
    }
    fetch('./graph.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((g) => g.modules && loadGraph(g, 'graph.json'))
      .catch(() => {});
  }, [loadGraph]);

  const selected = useMemo(
    () => graph?.modules.find((m) => m.id === selectedId) || null,
    [graph, selectedId],
  );

  const upstream = useMemo(
    () => (selectedId && graph ? graph.edges.filter((e) => e.to === selectedId) : []),
    [graph, selectedId],
  );
  const downstream = useMemo(
    () => (selectedId && graph ? graph.edges.filter((e) => e.from === selectedId) : []),
    [graph, selectedId],
  );

  // Blast-radius styling pass.
  useEffect(() => {
    if (!graph) return;
    setNodes((ns) =>
      ns.map((n) => {
        const d = blast?.get(n.id);
        const dim = blast && d === undefined;
        return {
          ...n,
          style: {
            ...n.style,
            opacity: dim ? 0.12 : 1,
            outline: d === 0 ? '2px solid #f43f5e' : undefined,
            outlineOffset: d === 0 ? 3 : undefined,
          },
          data: { ...n.data },
        };
      }),
    );
    setEdges((es) =>
      es.map((e) => {
        if (!blast) return { ...e, animated: false, style: { stroke: '#3f3f46', strokeWidth: 1.5 } };
        const a = blast.get(e.source);
        const b = blast.get(e.target);
        const inBlast = a !== undefined && b !== undefined && Math.abs(a - b) <= 1;
        return {
          ...e,
          animated: inBlast,
          style: {
            stroke: inBlast ? DEGREE_COLORS[Math.min(Math.max(a, b), 4)] : '#27272a',
            strokeWidth: inBlast ? 2.5 : 1,
          },
        };
      }),
    );
  }, [blast, graph]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeClick = useCallback((_: unknown, node: Node<CQNodeData>) => {
    setSelectedId(node.id);
  }, []);

  const startBlast = useCallback(
    (id: string) => {
      if (!graph) return;
      setBlast(blastRadius(graph, id));
      setSelectedId(id);
    },
    [graph],
  );

  const doSearch = useCallback(() => {
    if (!graph || !query.trim()) return;
    const q = query.trim().toLowerCase();
    const hit = nodes.find(
      (n) => n.id.toLowerCase().includes(q) || (n.data.label as string).toLowerCase().includes(q),
    );
    if (hit && flowRef.current) {
      setSelectedId(hit.id);
      flowRef.current.fitView({ nodes: [{ id: hit.id }], duration: 400, padding: 0.4 });
    }
  }, [graph, query, nodes]);

  const toggleIn = (set: Set<string>, v: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  };

  const onDrop = useCallback(
    (ev: React.DragEvent) => {
      ev.preventDefault();
      setDragOver(false);
      const f = ev.dataTransfer.files?.[0];
      if (f)
        readGraphFile(f)
          .then((g) => loadGraph(g, f.name))
          .catch(() => setError('That file is not a CodeQuest graph.json'));
    },
    [loadGraph],
  );

  /* ------------------------------ render ------------------------------ */

  if (!graph) {
    return (
      <div
        className={`drop-root${dragOver ? ' dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="drop-card">
          <div className="drop-logo">⬢</div>
          <h1>CodeQuest Visualizer</h1>
          <p>
            In your repo, run <code>npx codequest-ai start</code> —<br />
            this page opens with your graph already loaded.
          </p>
          <div className="drop-actions">
            <button
              className="ghost"
              onClick={() =>
                fetch('./sample-graph.json')
                  .then((r) => r.json())
                  .then((g) => loadGraph(g, 'sample-graph.json'))
                  .catch(() => setError('Sample graph not found'))
              }
            >
              Load sample
            </button>
            <button className="ghost" onClick={() => fileInput.current?.click()}>
              Open a graph.json file
            </button>
          </div>
          {error && <div className="drop-error">{error}</div>}
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                readGraphFile(f)
                  .then((g) => loadGraph(g, f.name))
                  .catch(() => setError('That file is not a CodeQuest graph.json'));
            }}
          />
        </div>
      </div>
    );
  }

  const cycles = graph.cycles || [];
  const blastList = blast
    ? [...blast.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    : [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⬢</span>
          <span className="brand-name">CodeQuest</span>
          <span className="brand-file" title={fileName}>{fileName}</span>
        </div>
        <div className="stats">
          <span><b>{graph.modules.length}</b> modules</span>
          <span><b>{graph.edges.length}</b> edges</span>
          <span className={cycles.length ? 'warn' : ''}><b>{cycles.length}</b> cycles</span>
          {graph.engine && <span className="badge">{graph.engine}</span>}
        </div>
        <div className="search">
          <input
            value={query}
            placeholder="Search files…  ⏎"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          />
        </div>
        <button className="ghost small" onClick={() => fileInput.current?.click()}>Load another</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              readGraphFile(f)
                .then((g) => loadGraph(g, f.name))
                .catch(() => setError('That file is not a CodeQuest graph.json'));
          }}
        />
      </header>

      <div className="main">
        <aside className="panel left">
          <section>
            <h3>Layers</h3>
            <div className="chips">
              {allLayers.map((l) => (
                <button
                  key={l}
                  className={`chip${layers.has(l) ? ' on' : ''}`}
                  onClick={() => toggleIn(layers, l, setLayers)}
                >
                  <span className="dot" style={{ background: LAYER_COLORS[l] || '#94a3b8' }} />
                  {l}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>Risk</h3>
            <div className="chips">
              {(Object.keys(RISK_COLORS) as Risk[]).map((r) => (
                <button
                  key={r}
                  className={`chip${risks.has(r) ? ' on' : ''}`}
                  onClick={() => toggleIn(risks, r, setRisks)}
                >
                  <span className="dot" style={{ background: RISK_COLORS[r] }} />
                  {r}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>Show</h3>
            <label className="toggle">
              <input type="checkbox" checked={!hideTests} onChange={() => setHideTests(!hideTests)} />
              Test files
            </label>
            <label className="toggle">
              <input type="checkbox" checked={!hideAssets} onChange={() => setHideAssets(!hideAssets)} />
              Configs & assets
            </label>
          </section>
          <section className="legend">
            <h3>Legend</h3>
            <div><span className="cq-entry-dot" /> entry point</div>
            <div><span className="edge-sample" /> import edge</div>
            <div className="counts">{counts.shown} shown · {counts.hidden} hidden</div>
          </section>
        </aside>

        <div className="canvas" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onInit={(inst) => { flowRef.current = inst; }}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.05}
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="#26262e" bgColor="#0a0a0c" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              style={{ background: '#101014', border: '1px solid #27272a', borderRadius: 8 }}
              nodeColor={(n) => RISK_COLORS[(n.data?.risk as Risk) || 'LOW']}
            />
          </ReactFlow>
          {blast && (
            <div className="blast-banner">
              <span>Blast radius · <b>{blast.size}</b> files affected</span>
              <button onClick={() => setBlast(null)}>Clear ✕</button>
            </div>
          )}
        </div>

        <aside className="panel right">
          {blast ? (
            <section className="blast-panel">
              <h3>Blast radius</h3>
              <div className="blast-source">{shortName(selectedId || '')}</div>
              <div className="blast-list">
                {blastList.map(([id, d]) => (
                  <button key={id} className="blast-row" onClick={() => setSelectedId(id)}>
                    <span className="degree" style={{ background: DEGREE_COLORS[Math.min(d, 4)] }}>{d}</span>
                    <span className="blast-path" title={id}>{shortName(id)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : selected ? (
            <section className="detail">
              <h3 title={selected.path}>{shortName(selected.path)}</h3>
              <div className="detail-path">{selected.path}</div>
              <div className="detail-meta">
                <span className="risk-badge" style={{ background: RISK_COLORS[selected.risk || 'LOW'] }}>
                  {selected.risk || 'LOW'}
                </span>
                <span className="layer-badge">{selected.layer}</span>
                {selected.isEntry && <span className="entry-badge">ENTRY</span>}
              </div>
              <div className="detail-stats">
                <div><b>{selected.lines}</b><span>lines</span></div>
                <div><b>{selected.fanIn}</b><span>dependents</span></div>
                <div><b>{selected.fanOut}</b><span>dependencies</span></div>
              </div>
              <button className="blast-btn" onClick={() => startBlast(selected.id)}>
                ◉ Show blast radius
              </button>
              {(window as unknown as { acquireVsCodeApi?: () => { postMessage: (m: unknown) => void } }).acquireVsCodeApi && (
                <button
                  className="ghost small"
                  style={{ width: '100%', marginBottom: 16 }}
                  onClick={() =>
                    (window as unknown as { acquireVsCodeApi: () => { postMessage: (m: unknown) => void } })
                      .acquireVsCodeApi()
                      .postMessage({ command: 'openFile', path: selected.path })
                  }
                >
                  Open in editor ⤴
                </button>
              )}
              {selected.exports.length > 0 && (
                <>
                  <h4>Exports ({selected.exports.length})</h4>
                  <div className="tags">{selected.exports.slice(0, 24).map((e) => <code key={e}>{e}</code>)}</div>
                </>
              )}
              {downstream.length > 0 && (
                <>
                  <h4>Imports ({downstream.length})</h4>
                  <div className="edge-list">
                    {downstream.map((e) => (
                      <button key={e.from + e.to} onClick={() => setSelectedId(e.to)} title={e.to}>
                        {shortName(e.to)}{e.line ? <span className="line">:{e.line}</span> : null}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {upstream.length > 0 && (
                <>
                  <h4>Imported by ({upstream.length})</h4>
                  <div className="edge-list">
                    {upstream.map((e) => (
                      <button key={e.to + e.from} onClick={() => setSelectedId(e.from)} title={e.from}>
                        {shortName(e.from)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : (
            <section className="hint">
              <h3>Explore</h3>
              <p>Click any module to inspect its exports, imports, and dependents.</p>
              <p>Open a module and hit <b>Show blast radius</b> to see everything a change would touch.</p>
              {cycles.length > 0 && (
                <div className="cycle-warn">
                  ⚠ {cycles.length} circular {cycles.length === 1 ? 'import' : 'imports'} detected
                  <div className="cycle-list">
                    {cycles.slice(0, 5).map((c, i) => (
                      <div key={i} title={c.join(' → ')}>{c.map(shortName).join(' → ')}</div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
