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

export type Scope = { kind: 'repo' } | { kind: 'folder'; path: string } | { kind: 'file'; id: string };
import { useFileCode } from './components/CodePanel';
import { CommandPalette, recordRecent, type PaletteCommand } from './components/CommandPalette';
import { FileTree } from './components/FileTree';
import { FileDetail } from './components/FileDetail';
import { FilterPanel } from './components/FilterPanel';
import { SettingsModal } from './components/SettingsModal';
import RepoGuide from './components/RepoGuide';
import { parseVoiceCommand, resolveTarget, speak, startListening, voiceSupported } from './lib/voice';
import { narrateFile, migrateProficiency, PROFICIENCY_LABELS, PROFICIENCY_ORDER, type Narration, type Proficiency } from './lib/narrate';
import { loadTheme, saveTheme, applyTheme, type ThemeId } from './lib/theme';

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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusLine, setFocusLine] = useState<number | undefined>(undefined);
  const [scope, setScope] = useState<Scope>({ kind: 'repo' });

  /** The graph actually drawn: whole repo, one folder, or one file's neighborhood. */
  const viewGraph = useMemo((): CodeQuestGraph | null => {
    if (!graph) return null;
    if (scope.kind === 'repo') return graph;
    if (scope.kind === 'folder') {
      const prefix = scope.path + '/';
      const ids = new Set(graph.modules.filter((m) => m.id.startsWith(prefix)).map((m) => m.id));
      return {
        ...graph,
        modules: graph.modules.filter((m) => ids.has(m.id)),
        edges: graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
        cycles: [],
      };
    }
    const ids = new Set<string>([scope.id]);
    for (const e of graph.edges) {
      if (e.from === scope.id) ids.add(e.to);
      if (e.to === scope.id) ids.add(e.from);
    }
    return {
      ...graph,
      modules: graph.modules.filter((m) => ids.has(m.id)),
      edges: graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
      cycles: [],
    };
  }, [graph, scope]);
  const [hideTests, setHideTests] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  );
  const [hideAssets, setHideAssets] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  );
  const [keyOnly, setKeyOnly] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  );
  const [layers, setLayers] = useState<Set<string>>(new Set());
  const [risks, setRisks] = useState<Set<string>>(new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']));
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [counts, setCounts] = useState({ shown: 0, hidden: 0 });
  const [tab, setTab] = useState<'info' | 'explain'>('info');
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState('');
  const [tip, setTip] = useState('');
  const [narration, setNarration] = useState<Narration | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [proficiency, setProficiency] = useState<Proficiency>(() => {
    try {
      return migrateProficiency(localStorage.getItem('codequest.proficiency'));
    } catch {
      return 'junior';
    }
  });

  const pickProf = useCallback((p: Proficiency) => {
    setProficiency(p);
    try { localStorage.setItem('codequest.proficiency', p); } catch { /* noop */ }
    setShowWelcome(false);
  }, []);
  const [theme, setThemeState] = useState<ThemeId>(() => loadTheme());
  const pickTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    saveTheme(t);
  }, []);
  useEffect(() => { applyTheme(loadTheme()); }, []);
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
  const layerCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of graph?.modules || []) c[m.layer] = (c[m.layer] || 0) + 1;
    return c;
  }, [graph]);

  useEffect(() => {
    if (allLayers.length && layers.size === 0) setLayers(new Set(allLayers));
  }, [allLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGraph = useCallback((g: CodeQuestGraph, name: string) => {
    setGraph(g);
    setFileName(name);
    setSelectedId(null);
    setBlast(null);
    setScope({ kind: 'repo' });
    setError('');
    // Large repos: declutter by default so the graph stays readable.
    // Small screens: also declutter — 180 nodes don't fit on a phone.
    const smallScreen = typeof window !== 'undefined' && window.innerWidth < 900;
    if (g.modules.length > 400 || smallScreen) {
      setHideTests(true);
      setHideAssets(true);
      setKeyOnly(smallScreen);
      if (g.modules.length > 400) setTip('Large repo — tests & configs hidden. Toggle them in Show.');
    } else {
      setHideTests(false);
      setHideAssets(false);
      setKeyOnly(false);
    }
  }, []);

  // Re-layout whenever the graph, scope, or filters change.
  useEffect(() => {
    if (!viewGraph) return;
    const { nodes: ns, edges: es, counts: c } = layoutGraph(viewGraph, {
      hideTests,
      hideAssets,
      keyOnly,
      layers: layers.size ? layers : new Set(allLayers),
      risks,
    });
    setNodes(ns);
    setEdges(es);
    setCounts(c);
    setSelectedId(null);
    setBlast(null);
  }, [viewGraph, hideTests, hideAssets, keyOnly, layers, risks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Try injected graph (VS Code extension) → ./graph.json → drop screen.
  useEffect(() => {
    const injected = (window as unknown as { __CODEQUEST_GRAPH__?: CodeQuestGraph }).__CODEQUEST_GRAPH__;
    if (injected && injected.modules) {
      loadGraph(injected, 'workspace');
      let welcomed = false;
      try { welcomed = !!localStorage.getItem('codequest.proficiency'); } catch { /* noop */ }
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
  const selectFile = useCallback((id: string, line?: number) => {
    recordRecent(id);
    setFocusLine(line);
    setBlast(null);
    setSelectedId(id);
  }, []);

  // Scoped diagrams: one file's neighborhood, one folder, or the whole repo.
  const showFileDiagram = useCallback((id: string) => {
    setScope({ kind: 'file', id });
    setSelectedId(null);
  }, []);
  const showFolderDiagram = useCallback((path: string) => {
    setScope({ kind: 'folder', path });
    setSelectedId(null);
  }, []);

  // Recompute the (deterministic, proficiency-adapted) narration whenever the selection changes.
  useEffect(() => {
    setTab('info');
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    if (selectedId && graph) setNarration(narrateFile(selectedId, graph, proficiency));
    else setNarration(null);
  }, [selectedId, graph, proficiency]);

  const listenToFile = useCallback((id: string) => {
    if (!graph) return;
    const n = narrateFile(id, graph, proficiency);
    setNarration(n);
    setTab('info');
    speak(`${n.purpose} ${n.impact}`);
  }, [graph, proficiency]);

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

  // Palette actions: "diagram", "architecture", "blast radius"…
  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = [
      {
        id: 'repo-diagram',
        label: 'Diagram: whole repo',
        sub: 'architecture overview',
        keywords: 'diagram graph architecture repo overview whole map',
        run: () => setScope({ kind: 'repo' }),
      },
    ];
    if (selectedId) {
      const dir = selectedId.split('/').slice(0, -1).join('/');
      cmds.push({
        id: 'file-diagram',
        label: `Diagram: ${shortName(selectedId)}`,
        sub: 'this file and its connections',
        keywords: 'diagram graph file connections',
        run: () => showFileDiagram(selectedId),
      });
      if (dir) {
        cmds.push({
          id: 'folder-diagram',
          label: `Diagram: ${dir}/`,
          sub: 'whole folder',
          keywords: 'diagram graph folder directory',
          run: () => showFolderDiagram(dir),
        });
      }
      cmds.push({
        id: 'blast',
        label: `Blast radius: ${shortName(selectedId)}`,
        sub: 'what breaks if this changes',
        keywords: 'blast radius impact break change',
        run: () => startBlast(selectedId),
      });
    }
    return cmds;
  }, [selectedId, showFileDiagram, showFolderDiagram, startBlast]);

  // ⌘K / Ctrl+K opens the command palette anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
            const n = narrateFile(id, graph, proficiency);
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
    [graph, selectedId, focusNode, selectFile, proficiency],
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
        if (!blast) return { ...e, animated: false, style: { stroke: 'var(--border-strong)', strokeWidth: 1.5 } };
        const a = blast.get(e.source);
        const b = blast.get(e.target);
        const inBlast = a !== undefined && b !== undefined && Math.abs(a - b) <= 1;
        return {
          ...e,
          animated: inBlast,
          style: {
            stroke: inBlast ? DEGREE_COLORS[Math.min(Math.max(a, b), 4)] : 'var(--border-strong)',
            strokeWidth: inBlast ? 2.5 : 1,
          },
        };
      }),
    );
  }, [blast, graph]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeClick = useCallback((_: unknown, node: Node<CQNodeData>) => {
    selectFile(node.id);
  }, [selectFile]);


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
        <button className="palette-trigger" onClick={() => setPaletteOpen(true)} title="Search files, symbols, code">
          <span>🔍</span><span className="pt-text">Search…</span><kbd>⌘K</kbd>
        </button>
        <select
          className="prof-select"
          value={proficiency}
          onChange={(e) => pickProf(e.target.value as Proficiency)}
          title="Your level — explanations adapt to it"
        >
          {PROFICIENCY_ORDER.map((p) => (
            <option key={p} value={p}>{PROFICIENCY_LABELS[p]}</option>
          ))}
        </select>
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
        <button className="ghost small" onClick={() => setShowGuide(true)} title="App guide: how to run it, how it flows, its database">📖 Guide</button>
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

      <div className={`main${selectedId ? ' file-open' : ''}`}>
        <aside className="panel left explorer">
          <FileTree
            graph={graph}
            selectedId={selectedId}
            onSelect={selectFile}
            onFolderDiagram={showFolderDiagram}
          />
          <FilterPanel
            allLayers={allLayers}
            layerCounts={layerCounts}
            f={{ layers, risks, hideTests, hideAssets, keyOnly }}
            onChange={(nf) => {
              setLayers(nf.layers);
              setRisks(nf.risks);
              setHideTests(nf.hideTests);
              setHideAssets(nf.hideAssets);
              setKeyOnly(nf.keyOnly);
            }}
          />
          <div className="flegend">
            <div><span className="cq-entry-dot" /> entry point</div>
            <div><span className="edge-sample" /> import edge</div>
            <div className="counts">{counts.shown} shown · {counts.hidden} hidden</div>
          </div>
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
            onDiagram={() => showFileDiagram(selected.id)}
            onSelectFile={selectFile}
            downstream={downstream}
            upstream={upstream}
            code={fileCode}
            loadError={fileLoadError}
            focusLine={focusLine}
            explainCtx={explainCtx}
            onNeedSettings={() => setShowSettings(true)}
          />
        ) : (
        <div className="canvas" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          {/* Scope breadcrumb: repo → folder → file, with explicit zoom-out options */}
          <div className="scope-bar">
            <button
              className={scope.kind === 'repo' ? 'on' : ''}
              onClick={() => setScope({ kind: 'repo' })}
              title="Whole repo diagram"
            >
              ⬢ Repo
            </button>
            {scope.kind === 'folder' && (
              <>
                {scope.path.split('/').map((seg, i, arr) => (
                  <span key={i} className="scope-crumb">
                    <span className="scope-sep">/</span>
                    <button
                      onClick={() => setScope({ kind: 'folder', path: arr.slice(0, i + 1).join('/') })}
                    >
                      {seg}
                    </button>
                  </span>
                ))}
                <span className="scope-count">{viewGraph?.modules.length} files</span>
              </>
            )}
            {scope.kind === 'file' && (
              <>
                <span className="scope-sep">/</span>
                <button
                  title="Open this file"
                  onClick={() => selectFile(scope.id)}
                >
                  📄 {shortName(scope.id)}
                </button>
                <button
                  className="scope-cta"
                  onClick={() => {
                    const dir = scope.id.split('/').slice(0, -1).join('/');
                    if (dir) setScope({ kind: 'folder', path: dir });
                    else setScope({ kind: 'repo' });
                  }}
                  title="Zoom out to the whole folder"
                >
                  ⤴ Folder
                </button>
                <button
                  className="scope-cta"
                  onClick={() => setScope({ kind: 'repo' })}
                  title="Zoom out to the whole repo"
                >
                  ⬢ Repo
                </button>
              </>
            )}
          </div>
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
            <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="var(--border)" bgColor="var(--bg)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              className="cq-minimap"
              style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-strong)', borderRadius: 8 }}
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
              <p className="hint-sub">Each box is a file. Lines show which files talk to which. Press <kbd>⌘K</kbd> to search everything.</p>
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
      {graph && (
        <CommandPalette
          graph={graph}
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSelect={(id, line) => selectFile(id, line)}
          commands={paletteCommands}
        />
      )}
      {showWelcome && graph && (
        <div className="modal-backdrop">
          <div className="modal welcome">
            <div className="drop-logo">⬢</div>
            <h2>This is a map of your codebase.</h2>
            <p className="modal-sub">
              Every box is a file. Lines show which files talk to which.
              Click anything to inspect it — read its code, hear what it does, see what would break if you changed it.
            </p>
            <p className="prof-q">How technical are you? <span>Explanations adapt to your level.</span></p>
            <div className="prof-cards">
              <button onClick={() => pickProf('non-technical')}>
                <b>Non-technical</b><span>Business view — why it matters</span>
              </button>
              <button onClick={() => pickProf('beginner')}>
                <b>Beginner</b><span>Plain language, no jargon</span>
              </button>
              <button onClick={() => pickProf('junior')}>
                <b>Junior Developer</b><span>Guided, terms explained</span>
              </button>
              <button onClick={() => pickProf('senior')}>
                <b>Senior Developer</b><span>Dense, mechanism-first</span>
              </button>
              <button onClick={() => pickProf('lead')}>
                <b>Lead Developer</b><span>Architecture and trade-offs</span>
              </button>
            </div>
            <button className="ghost prof-skip" onClick={() => pickProf(proficiency)}>
              Skip — explore on my own
            </button>
          </div>
        </div>
      )}
      {voiceMsg && <div className="toast voice">{voiceMsg}</div>}
      {showSettings && (
        <SettingsModal
          serverMode={serverMode}
          proficiency={proficiency}
          setProficiency={pickProf}
          theme={theme}
          setTheme={pickTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showGuide && graph && (
        <RepoGuide
          graph={graph}
          prof={proficiency}
          serverMode={serverMode}
          onClose={() => setShowGuide(false)}
          onOpenFile={(id) => { setShowGuide(false); selectFile(id); }}
        />
      )}
    </div>
  );
}
