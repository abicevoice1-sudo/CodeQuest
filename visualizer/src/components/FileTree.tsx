import { useEffect, useMemo, useState } from 'react';
import { RISK_COLORS, shortName, type CodeQuestGraph, type GraphModule } from '../types';

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  module?: GraphModule;
}

function buildTree(modules: GraphModule[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };
  for (const m of modules) {
    const parts = m.id.split('/');
    let node = root;
    let prefix = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      prefix = prefix ? `${prefix}/${part}` : part;
      const isLast = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part && c.isDir === !isLast);
      if (!child) {
        child = { name: part, path: prefix, isDir: !isLast, children: [], module: isLast ? m : undefined };
        node.children.push(child);
      }
      node = child;
    }
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) =>
      a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name),
    );
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return '🟨';
  if (['ts', 'tsx', 'mts'].includes(ext)) return '🔷';
  if (ext === 'py') return '🐍';
  if (ext === 'json') return '🟫';
  if (ext === 'md') return '📝';
  if (['css', 'scss', 'less'].includes(ext)) return '🎨';
  if (ext === 'html') return '🌐';
  return '📄';
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  onFolderDiagram,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFolderDiagram: (path: string) => void;
}) {
  if (node.isDir) {
    const open = expanded.has(node.path);
    return (
      <>
        <button
          className="ft-row ft-dir"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onToggle(node.path)}
        >
          <span className="ft-caret">{open ? '▾' : '▸'}</span>
          <span className="ft-icon">{open ? '📂' : '📁'}</span>
          <span className="ft-name">{node.name || '/'}</span>
          <span
            className="ft-diagram"
            title="View this folder as a diagram"
            onClick={(e) => { e.stopPropagation(); onFolderDiagram(node.path); }}
          >
            ◈
          </span>
          <span className="ft-count">{node.children.length}</span>
        </button>
        {open &&
          node.children.map((c) => (
            <TreeRow
              key={c.path}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
              onFolderDiagram={onFolderDiagram}
            />
          ))}
      </>
    );
  }
  const m = node.module!;
  const riskColor = RISK_COLORS[m.risk || 'LOW'];
  return (
    <button
      className={`ft-row ft-file${selectedId === m.id ? ' sel' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => onSelect(m.id)}
      title={m.id}
    >
      <span className="ft-caret" />
      <span className="ft-icon">{fileIcon(node.name)}</span>
      <span className="ft-name">{node.name}</span>
      {m.isEntry && <span className="ft-entry" title="Entry point">⚡</span>}
      {(m.risk === 'CRITICAL' || m.risk === 'HIGH') && (
        <span className="ft-risk" style={{ background: riskColor }} title={`${m.risk} risk`} />
      )}
    </button>
  );
}

export function FileTree({
  graph,
  selectedId,
  onSelect,
  onFolderDiagram,
}: {
  graph: CodeQuestGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFolderDiagram: (path: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mods = q
      ? graph.modules.filter((m) => m.id.toLowerCase().includes(q))
      : graph.modules;
    return buildTree(mods);
  }, [graph, query]);

  // Expand top-level folders by default; expand ancestors of the selection.
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const c of tree.children) if (c.isDir && c.path.split('/').length <= 2) next.add(c.path);
      if (selectedId) {
        const parts = selectedId.split('/');
        let prefix = '';
        for (let i = 0; i < parts.length - 1; i++) {
          prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
          next.add(prefix);
        }
      }
      return next;
    });
  }, [tree, selectedId]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div className="filetree">
      <div className="ft-search">
        <input
          value={query}
          placeholder="Filter files…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="ft-list">
        {tree.children.length === 0 && <div className="ft-empty">No files match.</div>}
        {tree.children.map((c) => (
          <TreeRow
            key={c.path}
            node={c}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            selectedId={selectedId}
            onSelect={onSelect}
            onFolderDiagram={onFolderDiagram}
          />
        ))}
      </div>
      <div className="ft-foot" title={shortName(graph.modules[0]?.id || '')}>
        {graph.modules.length} files
      </div>
    </div>
  );
}
