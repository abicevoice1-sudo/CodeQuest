import dagre from 'dagre';
import type { CodeQuestGraph, GraphModule } from './types';
import { shortName } from './types';
import type { Node, Edge } from '@xyflow/react';

export interface CQNodeData extends Record<string, unknown> {
  label: string;
  path: string;
  layer: string;
  risk: string;
  fanIn: number;
  fanOut: number;
  isEntry: boolean;
  isTest: boolean;
  kind: string;
}

const BASE_H = 64;

function nodeWidth(m: GraphModule): number {
  // Width grows with label length so text never clips.
  return Math.min(280, Math.max(150, shortName(m.path).length * 8.5 + 56));
}

function nodeHeight(m: GraphModule): number {
  // Taller nodes = more important (entry points, heavily depended-on).
  const importance = (m.fanIn || 0) + (m.isEntry ? 3 : 0);
  return BASE_H + Math.min(22, importance * 2.5);
}

export function layoutGraph(
  g: CodeQuestGraph,
  opts: { hideTests: boolean; hideAssets: boolean; layers: Set<string>; risks: Set<string> },
): { nodes: Node<CQNodeData>[]; edges: Edge[]; counts: { shown: number; hidden: number } } {
  const dag = new dagre.graphlib.Graph();
  dag.setGraph({ rankdir: 'LR', nodesep: 46, ranksep: 130, marginx: 40, marginy: 40 });
  dag.setDefaultEdgeLabel(() => ({}));

  const shown = g.modules.filter(
    (m) =>
      (!opts.hideTests || !m.isTest) &&
      (!opts.hideAssets || m.kind === 'code') &&
      opts.layers.has(m.layer) &&
      opts.risks.has(m.risk || 'LOW'),
  );
  const shownIds = new Set(shown.map((m) => m.id));
  shown.forEach((m) => dag.setNode(m.id, { width: nodeWidth(m), height: nodeHeight(m) }));
  const edges: Edge[] = [];
  for (const e of g.edges) {
    if (!shownIds.has(e.from) || !shownIds.has(e.to)) continue;
    dag.setEdge(e.from, e.to);
    edges.push({
      id: `${e.from}→${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#3f3f46', strokeWidth: 1.5 },
    });
  }
  dagre.layout(dag);

  const nodes: Node<CQNodeData>[] = shown.map((m) => {
    const p = dag.node(m.id);
    const w = nodeWidth(m);
    const h = nodeHeight(m);
    return {
      id: m.id,
      type: 'cq',
      position: { x: p.x - w / 2, y: p.y - h / 2 },
      data: {
        label: shortName(m.path),
        path: m.path,
        layer: m.layer,
        risk: m.risk || 'LOW',
        fanIn: m.fanIn,
        fanOut: m.fanOut,
        isEntry: m.isEntry,
        isTest: m.isTest,
        kind: m.kind,
      },
      style: { width: w, height: h },
    };
  });

  return { nodes, edges, counts: { shown: shown.length, hidden: g.modules.length - shown.length } };
}

/** BFS blast radius: degree map from source over both directions. */
export function blastRadius(g: CodeQuestGraph, source: string): Map<string, number> {
  const fwd = new Map<string, string[]>();
  const rev = new Map<string, string[]>();
  for (const e of g.edges) {
    if (!fwd.has(e.from)) fwd.set(e.from, []);
    if (!rev.has(e.to)) rev.set(e.to, []);
    fwd.get(e.from)!.push(e.to);
    rev.get(e.to)!.push(e.from);
  }
  const degree = new Map<string, number>([[source, 0]]);
  const queue: [string, number][] = [[source, 0]];
  while (queue.length) {
    const [id, d] = queue.shift()!;
    for (const n of [...(fwd.get(id) || []), ...(rev.get(id) || [])]) {
      if (!degree.has(n)) {
        degree.set(n, d + 1);
        queue.push([n, d + 1]);
      }
    }
  }
  return degree;
}
