/* API endpoint detection — finds every endpoint a codebase defines and
   explains it in plain language. Business people see "these are the doors
   into the app"; devs see method + path + implementation at a glance.
   Detection is static (paths + source regex), no runtime needed. */

import { readCode } from './coderead';
import type { CodeQuestGraph } from '../types';

export interface ApiEndpoint {
  method: string;    // GET, POST, PUT, DELETE, PATCH
  path: string;      // /api/users
  fileId: string;    // module id implementing it
  summary: string | null; // plain-language explanation
  framework: 'next-app' | 'next-pages' | 'express' | 'fastify' | 'generic';
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

/** Derive the URL path from a Next.js App Router route file. */
function nextAppPath(filePath: string): string | null {
  // app/api/users/route.ts -> /api/users
  // app/api/users/[id]/route.ts -> /api/users/:id
  const m = /(?:^|\/)app\/api\/(.+)\/route\.(ts|js)x?$/.exec(filePath);
  if (!m) return null;
  const parts = m[1].split('/').map((p) => {
    const dyn = /^\[(\.\.\.)?([^\]]+)\]$/.exec(p);
    if (dyn) return dyn[1] ? `*` : `:${dyn[2]}`;
    return p;
  });
  return '/api/' + parts.join('/');
}

/** Derive the URL path from a Next.js Pages Router API file. */
function nextPagesPath(filePath: string): string | null {
  // pages/api/users.ts -> /api/users ; pages/api/users/[id].ts -> /api/users/:id
  const m = /(?:^|\/)pages\/api\/(.+)\.(ts|js)x?$/.exec(filePath);
  if (!m || m[1] === 'route') return null;
  const parts = m[1].split('/').map((p) => {
    const dyn = /^\[(\.\.\.)?([^\]]+)\]$/.exec(p);
    if (dyn) return dyn[1] ? `*` : `:${dyn[2]}`;
    return p;
  });
  return '/api/' + parts.join('/');
}

/** Find Express/Fastify-style route registrations: app.get('/path', ...). */
function expressRoutes(src: string): { method: string; path: string }[] {
  const out: { method: string; path: string }[] = [];
  const re = /\b(?:app|router|fastify|server)\s*\.\s*(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const method = m[1].toUpperCase();
    if ((METHODS as readonly string[]).includes(method)) {
      out.push({ method, path: m[2] });
    }
  }
  return out;
}

/** Detect all endpoints in a single file. */
export function detectEndpoints(fileId: string, filePath: string, src: string): ApiEndpoint[] {
  const out: ApiEndpoint[] = [];
  const sig = readCode(src, filePath);

  // Next.js App Router: methods come from exported functions.
  const appPath = nextAppPath(filePath);
  if (appPath) {
    for (const method of sig.apiMethods) {
      const doc = sig.exports.find((e) => e.name === method)?.doc;
      out.push({
        method,
        path: appPath,
        fileId,
        summary: doc || null,
        framework: 'next-app',
      });
    }
    // route.ts with a default handler but no named method exports
    if (!out.length && /export\s+default/.test(src)) {
      out.push({ method: 'ALL', path: appPath, fileId, summary: sig.topDoc || null, framework: 'next-app' });
    }
    return out;
  }

  // Next.js Pages Router: single handler, method from code or ALL.
  const pagesPath = nextPagesPath(filePath);
  if (pagesPath) {
    const methods = [...new Set(
      [...src.matchAll(/req\.method\s*===?\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`]/gi)].map((m) => m[1].toUpperCase())
    )];
    out.push({
      method: methods.length ? methods.join(', ') : 'ALL',
      path: pagesPath,
      fileId,
      summary: sig.topDoc || null,
      framework: 'next-pages',
    });
    return out;
  }

  // Express / Fastify style.
  for (const r of expressRoutes(src)) {
    out.push({
      method: r.method,
      path: r.path,
      fileId,
      summary: sig.topDoc || null,
      framework: /fastify/.test(src) ? 'fastify' : 'express',
    });
  }
  return out;
}

/** Scan the whole graph for endpoints. Needs a source-code lookup. */
export function findAllEndpoints(
  graph: CodeQuestGraph,
  getSource: (id: string) => string | undefined,
): ApiEndpoint[] {
  const out: ApiEndpoint[] = [];
  for (const m of graph.modules) {
    if (m.isTest) continue;
    // Fast path: Next.js routes are fully determined by path + exports (no source needed).
    const appPath = nextAppPath(m.path);
    if (appPath) {
      const methods = (m.exports || []).filter((e) => (METHODS as readonly string[]).includes(e));
      const src = getSource(m.id);
      const sig = src ? readCode(src, m.path) : null;
      if (methods.length) {
        for (const method of methods) {
          const doc = sig?.exports.find((e) => e.name === method)?.doc;
          out.push({ method, path: appPath, fileId: m.id, summary: doc || null, framework: 'next-app' });
        }
      } else if (src && /export\s+default/.test(src)) {
        out.push({ method: 'ALL', path: appPath, fileId: m.id, summary: sig?.topDoc || null, framework: 'next-app' });
      } else if (methods.length === 0 && !src) {
        // No source and no method exports — still list the path, method unknown.
        out.push({ method: '?', path: appPath, fileId: m.id, summary: null, framework: 'next-app' });
      }
      continue;
    }
    const pagesPath = nextPagesPath(m.path);
    if (pagesPath) {
      const src = getSource(m.id);
      const sig = src ? readCode(src, m.path) : null;
      const methods = src
        ? [...new Set([...src.matchAll(/req\.method\s*===?\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`]/gi)].map((x) => x[1].toUpperCase()))]
        : [];
      out.push({
        method: methods.length ? methods.join(', ') : '?',
        path: pagesPath,
        fileId: m.id,
        summary: sig?.topDoc || null,
        framework: 'next-pages',
      });
      continue;
    }
    // Express/Fastify need source — skip if unavailable.
    const src = getSource(m.id);
    if (!src) continue;
    if (!/(app|router|fastify)\s*\.\s*(get|post|put|delete|patch)/i.test(src.slice(0, 3000))) continue;
    out.push(...detectEndpoints(m.id, m.path, src));
  }
  // Sort: path then method.
  out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return out;
}

/** Plain-language business explanation for an endpoint. */
export function explainEndpoint(e: ApiEndpoint): string {
  const what = (() => {
    if (/\/login|\/signin|\/auth/i.test(e.path)) return 'lets customers log in';
    if (/\/logout|\/signout/i.test(e.path)) return 'logs customers out';
    if (/\/register|\/signup/i.test(e.path)) return 'creates new customer accounts';
    if (/\/users/i.test(e.path)) return e.method.includes('GET') ? 'fetches customer data' : 'manages customer accounts';
    if (/\/orders/i.test(e.path)) return 'handles customer orders';
    if (/\/products/i.test(e.path)) return 'serves the product catalog';
    if (/\/payments|\/billing|\/checkout/i.test(e.path)) return 'processes payments';
    if (/\/search/i.test(e.path)) return 'searches the app';
    if (/\/upload/i.test(e.path)) return 'receives file uploads';
    if (/\/webhook/i.test(e.path)) return 'receives updates from an external service';
    if (/\/health/i.test(e.path)) return 'reports whether the app is running';
    return 'serves app data';
  })();
  const methodWord = e.method === 'GET' ? 'Reading' : e.method === 'POST' ? 'Creating' : e.method === 'PUT' || e.method === 'PATCH' ? 'Updating' : e.method === 'DELETE' ? 'Deleting' : 'Handling';
  return `${methodWord} via ${e.method} ${e.path} — ${what}.`;
}
