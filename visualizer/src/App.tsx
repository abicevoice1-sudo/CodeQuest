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
import { useFileCode } from './components/CodePanel';
import { FileTree } from './components/FileTree';
import { FileDetail } from './components/FileDetail';
import { SettingsModal } from './components/SettingsModal';
import { parseVoiceCommand, resolveTarget, speak, startListening, voiceSupported } from './lib/voice';
import { fuzzySearch } from './lib/search';
import { narrateFile, type Narration } from './lib/narrate';

/* ------------------------------------------------------------------ */
/* Custom node                                                         */
/* ------------------------------------------------------------------ */

function CQNode({ data, selected }: NodeProps<Node<CQNodeData>>) {
  const color = RISK_COLORS[(data.risk as Risk) || 'LOW'];
  const hot = data.risk === 'CRITICAL' || data.risk === 'HIGH';
  return (
    <div
      className={`cq-node${selected ? ' selected' : ''}${data.isTest ? ' test' : ''}${hot ? ' hot' : ''}`}
      style={{ ['--risk' as string]: color }}
    >
      <Handle type="target" position={Position.Left} className="cq-handle" />
      <span className="cq-riskbar" />
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
  const [tab, setTab] = useState<'info' | 'explain'>('info');
  const [showSettings, setShowSettings] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [searchIdx, setSearchIdx] = useState(0);
  const [tip, setTip] = useState('');
  const [narration, setNarration] = useState<Narration | null>(null);
  const [tour, setTour] = useState<{ stops: string[]; idx: number } | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const serverMode =
    typeof window !== 'undefined' &&
    !!(window as unknown as { __CODEQUEST_GRAPH__?: unknown }).__CODEQUEST_GRAPH__;

  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(''), 9000);
    return () => clearTimeout(t);
  }, [tip ]);
  const flowRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const fileInput = useRef<HTMLInputElement>(null);
  const stopListenRef = useRef<(() => void) | null>(null);

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
    // Large repos: declutter by default so the graph stays readable.
    if (g.modules.length > 400) {
      setHideTests(true);
      setHideAssets(true);
      setTip('Large repo — tests & configs hidden. Toggle them in Show.');
    } else {
      setHideTests(false);
      setHideAssets(false);
    }
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
      let welcomed = false;
      try { welcomed = !!localStorage.getItem('codequest.welcomed'); } catch { /* noop */ }
      if (!welcomed && injected.modules.length <= 400) {
        setShowWelcome(true);
      } else if (injected.modules.length <= 400) {
        setTip('Click any module to inspect it — Code, Explain, blast radius. 🎙 Voice works in Chrome.');
      }
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

  const { code: fileCode, loadError: fileLoadError } = useFileCode(selectedId);

  // Select a file: opens the split detail view (info | code).
  const selectFile = useCallback((id: string) => {
    setBlast(null);
    setSelectedId(id);
  }, []);

  // Reset to the info tab whenever a different module is selected.
  useEffect(() => {
    setTab('info');
    setNarration(null);
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  }, [selectedId]);

  const listenToFile = useCallback((id: string) => {
    if (!graph) return;
    const n = narrateFile(id, graph);
    setNarration(n);
    setTab('info');
    speak(`${n.purpose} ${n.impact}`);
  }, [graph]);

  // Camera-only: fly to a node without opening the detail view.
  const focusNode = useCallback((id: string) => {
    if (flowRef.current) flowRef.current.fitView({ nodes: [{ id }], duration: 400, padding: 0.4 });
  }, []);

  const explainCtx = useMemo(
    () =>
      selected
        ? {
            path: selected.path,
            layer: selected.layer,
            risk: selected.risk,
            lines: selected.lines,
            imports: downstream.map((e) => e.to),
            importedBy: upstream.map((e) => e.from),
            exports: selected.exports,
            code: fileCode || '',
          }
        : null,
    [selected, downstream, upstream, fileCode],
  );

  const startBlast = useCallback(
    (id: string) => {
      if (!graph) return;
      setBlast(blastRadius(graph, id));
      setSelectedId(null); // back to the graph so the blast is visible
    },
    [graph],
  );

  const searchResults = useMemo(
    () => (graph && query.trim() ? fuzzySearch(query, graph.modules.map((m) => m.id)) : []),
    [graph, query],
  );

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSearchIdx((i) => Math.min(i + 1, searchResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      const hit = searchResults[searchIdx] || searchResults[0];
      if (hit) { selectFile(hit.id); setSearchFocus(false); }
    } else if (e.key === 'Escape') { setSearchFocus(false); }
  };

  useEffect(() => { setSearchIdx(0); }, [query]);

  /* ---------------- voice control ---------------- */
  const handleVoice = useCallback(
    (transcript: string) => {
      setVoiceMsg(`🎙 “${transcript}”`);
      const cmd = parseVoiceCommand(transcript);
      const ids = graph?.modules.map((m) => m.id) || [];
      if (cmd.kind === 'find') {
        const q = cmd.query.toLowerCase();
        const hits = ids.filter((id) => id.toLowerCase().includes(q));
        if (hits.length) {
          selectFile(hits[0]);
          const msg = hits.length === 1 ? `Found ${hits[0]}` : `Found ${hits.length} files, showing ${hits[0]}`;
          setVoiceMsg(msg);
          speak(msg);
        } else {
          setVoiceMsg(`No files match “${cmd.query}”.`);
          speak(`No files match ${cmd.query}.`);
        }
      } else if (cmd.kind === 'explain' || cmd.kind === 'blast') {
        const id = cmd.target ? resolveTarget(cmd.target, ids) : selectedId;
        if (!id) {
          const msg = cmd.target ? `Couldn't find “${cmd.target}”.` : 'Select a file first, or name one.';
          setVoiceMsg(msg);
          speak(msg);
          return;
        }
        focusNode(id);
        if (cmd.kind === 'blast') {
          startBlast(id);
          setVoiceMsg(`Blast radius for ${shortName(id)}.`);
          speak(`Showing blast radius for ${shortName(id)}. Check the panel.`);
        } else {
          // Voice explain = spoken purpose + impact, no API key needed.
          selectFile(id);
          if (graph) {
            const n = narrateFile(id, graph);
            setNarration(n);
            setTab('info');
            setVoiceMsg(`${shortName(id)}: ${n.purpose}`);
            speak(`${n.purpose} ${n.impact}`);
          }
        }
      } else if (cmd.kind === 'clear') {
        setBlast(null);
        setSelectedId(null);
        setVoiceMsg('Cleared.');
        speak('Cleared.');
      } else {
        const msg = `Try “find login”, “explain this file”, or “blast radius of auth”.`;
        setVoiceMsg(msg);
        speak(`I didn't catch that. ${msg}`);
      }
    },
    [graph, selectedId, focusNode, selectFile],
  );

  const toggleListen = useCallback(() => {
    if (listening) {
      stopListenRef.current?.();
      setListening(false);
      return;
    }
    setVoiceMsg('Listening… say “find login” or “explain this file”.');
    setListening(true);
    stopListenRef.current = startListening(
      (t) => { setListening(false); handleVoice(t); },
      () => setListening(false),
      (msg) => { setListening(false); setVoiceMsg(msg); },
    );
  }, [listening, handleVoice]);

  /* ---------------- guided tour ---------------- */
  const startTour = useCallback(() => {
    if (!graph) return;
    const stops = [...graph.modules]
      .filter((m) => !m.isTest && m.kind === 'code')
      .sort(
        (a, b) =>
          (b.fanIn + b.fanOut + (b.isEntry ? 5 : 0)) - (a.fanIn + a.fanOut + (a.isEntry ? 5 : 0)),
      )
      .slice(0, 5)
      .map((m) => m.id);
    if (!stops.length) return;
    setShowWelcome(false);
    try { localStorage.setItem('codequest.welcomed', '1'); } catch { /* noop */ }
    setSelectedId(null); // tour runs on the graph
    setTour({ stops, idx: 0 });
  }, [graph]);

  const stopTour = useCallback(() => {
    setTour(null);
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  }, []);

  const tourNext = useCallback(() => {
    setTour((t) => {
      if (!t) return t;
      if (t.idx >= t.stops.length - 1) {
        try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
        return null;
      }
      return { stops: t.stops, idx: t.idx + 1 };
    });
  }, []);

  // Each tour stop: fly to the file, show + speak its purpose and impact.
  useEffect(() => {
    if (!tour || !graph) return;
    const id = tour.stops[tour.idx];
    if (!id) { setTour(null); return; }
    focusNode(id);
    const n = narrateFile(id, graph);
    setNarration(n);
    setTab('info');
    setVoiceMsg(`Tour ${tour.idx + 1} of ${tour.stops.length}: ${shortName(id)}`);
    speak(`${n.purpose} ${n.impact}`, () => {
      setTimeout(() => tourNext(), 1200);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  /* ---------------- plain-language insights ---------------- */
  const insights = useMemo(() => {
    if (!graph) return [] as string[];
    const out: string[] = [];
    const entries = graph.modules.filter((m) => m.isEntry);
    out.push(
      `This codebase has ${graph.modules.length} files and ${graph.edges.length} connections between them.` +
        (entries.length ? ` It starts in ${entries.length === 1 ? 'one place' : `${entries.length} places`}.` : '')
    );
    const top = [...graph.modules]
      .filter((m) => !m.isTest)
      .sort((a, b) => b.fanIn + b.fanOut - (a.fanIn + a.fanOut))[0];
    if (top) {
      out.push(
        `${shortName(top.path)} is the most connected file — ${top.fanIn} other file${top.fanIn === 1 ? '' : 's'} depend on it.`
      );
    }
    const cycles = graph.cycles?.length || 0;
    if (cycles) out.push(`⚠ ${cycles} circular import${cycles === 1 ? '' : 's'} — files importing each other in a loop. Worth fixing.`);
    const crit = graph.modules.filter((m) => m.risk === 'CRITICAL').length;
    if (crit) out.push(`${crit} file${crit === 1 ? '' : 's'} marked critical risk — change carefully.`);
    return out;
  }, [graph]);

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
    selectFile(node.id);
  }, [selectFile]);


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
            placeholder="Search files…"
            onChange={(e) => { setQuery(e.target.value); setSearchFocus(true); }}
            onKeyDown={onSearchKey}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
          />
          {searchFocus && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((h, i) => (
                <button
                  key={h.id}
                  className={i === searchIdx ? 'on' : ''}
                  onMouseDown={(e) => { e.preventDefault(); selectFile(h.id); setSearchFocus(false); }}
                  onMouseEnter={() => setSearchIdx(i)}
                  title={h.id}
                >
                  {shortName(h.id)}
                  <span className="sr-path">{h.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {!serverMode && (
          <button className="ghost small" onClick={() => fileInput.current?.click()}>Load another</button>
        )}
        {voiceSupported() && (
          <button
            className={`ghost small${listening ? ' listening' : ''}`}
            onClick={toggleListen}
            title='Voice: "find login", "explain this file", "blast radius of auth"'
          >
            {listening ? '⏹ Listening…' : '🎙 Voice'}
          </button>
        )}
        <button className="ghost small" onClick={() => setShowSettings(true)} title="AI settings">⚙</button>
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
        <aside className="panel left explorer">
          <FileTree graph={graph} selectedId={selectedId} onSelect={selectFile} />
          <details className="filters">
            <summary>Graph filters</summary>
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
          </details>
        </aside>

        {selected && selectedId ? (
          <FileDetail
            module={selected}
            narration={narration}
            detailTab={tab}
            setDetailTab={setTab}
            onBack={() => setSelectedId(null)}
            onListen={() => listenToFile(selected.id)}
            onBlast={() => startBlast(selected.id)}
            onSelectFile={selectFile}
            downstream={downstream}
            upstream={upstream}
            code={fileCode}
            loadError={fileLoadError}
            explainCtx={explainCtx}
            onNeedSettings={() => setShowSettings(true)}
          />
        ) : (
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
        )}

        <aside className="panel right">
          {blast ? (
            <section className="blast-panel">
              <h3>Blast radius</h3>
              <div className="blast-source">{shortName(selectedId || '')}</div>
              <div className="blast-list">
                {blastList.map(([id, d]) => (
                  <button key={id} className="blast-row" onClick={() => selectFile(id)}>
                    <span className="degree" style={{ background: DEGREE_COLORS[Math.min(d, 4)] }}>{d}</span>
                    <span className="blast-path" title={id}>{shortName(id)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="hint">
              <h3>What am I looking at?</h3>
              {insights.map((s, i) => (
                <p key={i} className="insight">{s}</p>
              ))}
              <button className="tour-cta" onClick={startTour}>▶ Take the guided tour</button>
              <p className="hint-sub">Each box is a file. Lines show which files talk to which. Click any box to inspect it.</p>
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
      {tip && <div className="toast tip">{tip}</div>}
      {tour && (
        <div className="tour-bar">
          <span className="tour-progress">Tour {tour.idx + 1} of {tour.stops.length}</span>
          <span className="tour-file">{shortName(tour.stops[tour.idx])}</span>
          <button className="ghost small" onClick={tourNext}>Next →</button>
          <button className="ghost small" onClick={stopTour}>✕ Stop</button>
        </div>
      )}
      {showWelcome && graph && (
        <div className="modal-backdrop">
          <div className="modal welcome">
            <div className="drop-logo">⬢</div>
            <h2>This is a map of your codebase.</h2>
            <p className="modal-sub">
              Every box is a file. Lines show which files talk to which.
              Bigger glowing boxes are the important ones. Click anything to inspect it —
              read its code, hear what it does, see what would break if you changed it.
            </p>
            <div className="modal-actions welcome-actions">
              <button className="tour-go" onClick={startTour}>▶ Take the guided tour</button>
              <button className="ghost" onClick={() => {
                setShowWelcome(false);
                try { localStorage.setItem('codequest.welcomed', '1'); } catch { /* noop */ }
              }}>Explore on my own</button>
            </div>
          </div>
        </div>
      )}
      {voiceMsg && <div className="toast voice">{voiceMsg}</div>}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
