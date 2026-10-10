import { describe, it, expect } from 'vitest';
import { detectEndpoints, explainEndpoint } from './lib/api';
import type { CodeQuestGraph } from './types';

describe('detectEndpoints — Next.js App Router', () => {
  it('derives path and methods from route.ts', () => {
    const src = `/** Returns the user list. */
export async function GET() {}
export async function POST() {}
`;
    const eps = detectEndpoints('a', 'app/api/users/route.ts', src);
    expect(eps).toHaveLength(2);
    expect(eps[0]).toMatchObject({ method: 'GET', path: '/api/users', framework: 'next-app' });
    expect(eps[1].method).toBe('POST');
    expect(eps[0].summary).toContain('Returns the user list');
  });

  it('handles dynamic segments', () => {
    const eps = detectEndpoints('a', 'app/api/users/[id]/route.ts', `export async function GET() {}`);
    expect(eps[0].path).toBe('/api/users/:id');
  });

  it('handles catch-all segments', () => {
    const eps = detectEndpoints('a', 'app/api/files/[...path]/route.ts', `export async function GET() {}`);
    expect(eps[0].path).toBe('/api/files/*');
  });
});

describe('detectEndpoints — Next.js Pages Router', () => {
  it('derives path from pages/api', () => {
    const src = `export default function handler(req, res) {
  if (req.method === 'GET') {}
  if (req.method === 'POST') {}
}`;
    const eps = detectEndpoints('a', 'pages/api/login.ts', src);
    expect(eps).toHaveLength(1);
    expect(eps[0].path).toBe('/api/login');
    expect(eps[0].method).toContain('GET');
    expect(eps[0].method).toContain('POST');
  });
});

describe('detectEndpoints — Express', () => {
  it('finds app.get/app.post registrations', () => {
    const src = `app.get('/users', handler);
router.post('/users', createUser);
`;
    const eps = detectEndpoints('a', 'src/server.ts', src);
    expect(eps.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /users',
      'POST /users',
    ]);
  });

  it('ignores non-endpoint files', () => {
    expect(detectEndpoints('a', 'src/utils.ts', `export const x = 1;`)).toEqual([]);
  });
});

describe('explainEndpoint', () => {
  it('explains login endpoints for business people', () => {
    const s = explainEndpoint({ method: 'POST', path: '/api/login', fileId: 'a', summary: null, framework: 'next-app' });
    expect(s).toContain('/api/login');
    expect(s.toLowerCase()).toContain('log in');
  });

  it('explains generic endpoints', () => {
    const s = explainEndpoint({ method: 'GET', path: '/api/widgets', fileId: 'a', summary: null, framework: 'express' });
    expect(s).toContain('GET /api/widgets');
  });
});

// findAllEndpoints graph-only fast path
import { findAllEndpoints } from './lib/api';

describe('findAllEndpoints', () => {
  const graph = {
    modules: [
      { id: 'r1', path: 'app/api/users/route.ts', kind: 'code', lang: 'typescript', lines: 10, exports: ['GET', 'POST'], isTest: false, isEntry: false, layer: 'api', imports: [], fanIn: 0, fanOut: 0, risk: 'LOW' },
      { id: 'u1', path: 'src/utils.ts', kind: 'code', lang: 'typescript', lines: 5, exports: ['x'], isTest: false, isEntry: false, layer: 'util', imports: [], fanIn: 0, fanOut: 0, risk: 'LOW' },
    ],
    edges: [],
  } as unknown as CodeQuestGraph;

  it('detects Next.js routes from graph exports without source', () => {
    const eps = findAllEndpoints(graph, () => undefined);
    expect(eps).toHaveLength(2);
    expect(eps[0]).toMatchObject({ method: 'GET', path: '/api/users' });
  });
});
