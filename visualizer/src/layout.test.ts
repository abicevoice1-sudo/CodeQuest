import { describe, it, expect } from 'vitest';
import { blastRadius, layoutGraph } from './layout';
import type { CodeQuestGraph } from './types';

const graph: CodeQuestGraph = {
  modules: [
    { id: 'a.ts', path: 'src/a.ts', kind: 'code', lang: 'typescript', lines: 10, exports: [], isTest: false, isEntry: true, layer: 'entry', imports: [], fanIn: 0, fanOut: 1, risk: 'LOW' },
    { id: 'b.ts', path: 'src/b.ts', kind: 'code', lang: 'typescript', lines: 20, exports: [], isTest: false, isEntry: false, layer: 'domain', imports: [], fanIn: 1, fanOut: 1, risk: 'HIGH' },
    { id: 'c.ts', path: 'src/c.ts', kind: 'code', lang: 'typescript', lines: 30, exports: [], isTest: false, isEntry: false, layer: 'domain', imports: [], fanIn: 1, fanOut: 0, risk: 'CRITICAL' },
    { id: 't.ts', path: 'src/t.test.ts', kind: 'code', lang: 'typescript', lines: 5, exports: [], isTest: true, isEntry: false, layer: 'test', imports: [], fanIn: 0, fanOut: 0, risk: 'LOW' },
  ],
  edges: [
    { from: 'a.ts', to: 'b.ts' },
    { from: 'b.ts', to: 'c.ts' },
  ],
};

const allLayers = new Set(['entry', 'domain', 'test']);
const allRisks = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

describe('blastRadius', () => {
  it('assigns degrees outward in both directions', () => {
    const d = blastRadius(graph, 'b.ts');
    expect(d.get('b.ts')).toBe(0);
    expect(d.get('a.ts')).toBe(1); // upstream
    expect(d.get('c.ts')).toBe(1); // downstream
    expect(d.has('t.ts')).toBe(false); // disconnected
  });

  it('reaches transitively', () => {
    const d = blastRadius(graph, 'a.ts');
    expect(d.get('c.ts')).toBe(2);
  });
});

describe('layoutGraph', () => {
  it('lays out one node per shown module', () => {
    const { nodes, edges } = layoutGraph(graph, { hideTests: false, hideAssets: false, keyOnly: false, layers: allLayers, risks: allRisks });
    expect(nodes).toHaveLength(4);
    expect(edges).toHaveLength(2);
    for (const n of nodes) {
      expect(n.position.x).toBeTypeOf('number');
      expect(n.position.y).toBeTypeOf('number');
    }
  });

  it('hides test files on demand', () => {
    const { nodes, counts } = layoutGraph(graph, { hideTests: true, hideAssets: false, keyOnly: false, layers: allLayers, risks: allRisks });
    expect(nodes).toHaveLength(3);
    expect(counts.hidden).toBe(1);
  });

  it('filters by risk', () => {
    const { nodes } = layoutGraph(graph, {
      hideTests: false, hideAssets: false, keyOnly: false, layers: allLayers,
      risks: new Set(['CRITICAL']),
    });
    expect(nodes.map((n) => n.id)).toEqual(['c.ts']);
  });

  it('drops edges touching hidden nodes', () => {
    const { edges } = layoutGraph(graph, {
      hideTests: false, hideAssets: false, keyOnly: false,
      layers: new Set(['entry']), risks: allRisks,
    });
    expect(edges).toHaveLength(0);
  });
});
