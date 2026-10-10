// CodeQuest graph.json contract (subset the visualizer consumes).
export interface GraphModule {
  id: string;
  path: string;
  kind: 'code' | 'config' | 'document' | 'image' | 'data';
  lang: string;
  lines: number;
  size?: number;
  summary?: string;
  exports: string[];
  isTest: boolean;
  isEntry: boolean;
  layer: string;
  imports: { raw: string; line?: number; reexport?: boolean; resolved: string | null }[];
  fanIn: number;
  fanOut: number;
  risk?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  line?: number;
  names?: string[];
}

/* Repo intelligence (graph.intel) — deterministic repo briefing. */
export interface IntelRunStep {
  title: string;
  command: string;
  optional?: boolean;
}
export interface IntelRunbook {
  language: string;
  packageManager: string | null;
  scripts: string[];
  steps: IntelRunStep[];
  port: number | null;
  quickstart: { heading: string; lines: string[] } | null;
  hasDocker: boolean;
}
export interface IntelEngine {
  engine: string;
  kind: string;
  via: string[];
}
export interface IntelDatabase {
  engines: IntelEngine[];
  envVars: { name: string; file: string }[];
  prismaSchema: string | null;
}
export interface IntelColumn {
  name: string;
  type: string;
}
export interface IntelTable {
  name: string;
  model?: string;
  source: string;
  columns: IntelColumn[];
  orm: string;
}
export interface IntelFlowStep {
  file: string;
  depth: number;
  via: string | null;
}
export interface IntelPipelineLink {
  from: string;
  to: string;
  count: number;
}
export interface IntelFlow {
  primaryEntry: string;
  entryCount: number;
  entries: string[];
  steps: IntelFlowStep[];
  pipeline: IntelPipelineLink[];
}
export interface RepoIntel {
  runbook: IntelRunbook;
  database: IntelDatabase;
  schema: { tables: IntelTable[] };
  flow: IntelFlow | null;
}

export interface CodeQuestGraph {
  root?: string;
  scannedAt?: string;
  engine?: string;
  audience?: string;
  businessLens?: boolean;
  modules: GraphModule[];
  edges: GraphEdge[];
  cycles?: string[][];
  intel?: RepoIntel;
}

export type Risk = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const RISK_COLORS: Record<Risk, string> = {
  CRITICAL: '#f43f5e',
  HIGH: '#fb923c',
  MEDIUM: '#facc15',
  LOW: '#71717a',
};

export const LAYER_COLORS: Record<string, string> = {
  entry: '#38bdf8',
  app: '#38bdf8',
  domain: '#a78bfa',
  infra: '#34d399',
  util: '#fbbf24',
  test: '#71717a',
  config: '#f472b6',
  docs: '#94a3b8',
  assets: '#94a3b8',
};

export function shortName(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1];
}
