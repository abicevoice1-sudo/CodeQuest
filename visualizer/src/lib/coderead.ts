/* Code reader — extracts real signals from source code so explanations
   are grounded in what the file actually does, not just its filename.
   Pure regex-based parsing (no AST) — fast, dependency-free, good enough
   for narration. */

export interface CodeSignals {
  exports: { name: string; kind: 'function' | 'class' | 'const' | 'type' | 'default'; doc?: string }[];
  isReactComponent: boolean;
  isApiHandler: boolean;
  apiMethods: string[];
  isTest: boolean;
  isHook: boolean;
  functionCount: number;
  classCount: number;
  lineCount: number;
  commentRatio: number; // 0..1 of lines that are comments
  topDoc?: string;      // file-level docblock, if any
  imports: string[];    // imported module names
}

const DOC_RE = /\/\*\*([\s\S]*?)\*\//g;

function cleanDoc(raw: string): string {
  return raw
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .filter((l) => l && !l.startsWith('@'))
    .join(' ')
    .trim();
}

/** Extract JSDoc blocks mapped to the line number they precede. */
function docMap(src: string): Map<number, string> {
  const map = new Map<number, string>();
  const lines = src.split('\n');
  let m: RegExpExecArray | null;
  DOC_RE.lastIndex = 0;
  while ((m = DOC_RE.exec(src))) {
    const before = src.slice(0, m.index).split('\n').length; // 1-based line of /** start
    const endLine = before + m[0].split('\n').length - 1;
    const doc = cleanDoc(m[1]);
    if (doc) map.set(endLine + 1, doc); // doc applies to the next line
  }
  void lines;
  return map;
}

export function readCode(src: string, fileName: string): CodeSignals {
  const lines = src.split('\n');
  const docs = docMap(src);
  const exports: CodeSignals['exports'] = [];

  const pushExport = (name: string, kind: CodeSignals['exports'][number]['kind'], lineNo: number) => {
    // Avoid duplicates (e.g. `export function` + `export {`).
    if (exports.some((e) => e.name === name)) return;
    exports.push({ name, kind, doc: docs.get(lineNo) });
  };

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    const t = line.trim();
    let m: RegExpExecArray | null;
    if ((m = /^export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(t))) {
      pushExport(m[2], 'function', lineNo);
    } else if ((m = /^export\s+class\s+([A-Za-z_$][\w$]*)/.exec(t))) {
      pushExport(m[1], 'class', lineNo);
    } else if ((m = /^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(t))) {
      pushExport(m[2], 'const', lineNo);
    } else if ((m = /^export\s+(interface|type)\s+([A-Za-z_$][\w$]*)/.exec(t))) {
      pushExport(m[2], 'type', lineNo);
    } else if ((m = /^export\s+default\s+(function\s+([A-Za-z_$][\w$]*))?/.exec(t))) {
      pushExport(m[2] || 'default', 'default', lineNo);
    } else if ((m = /^export\s*\{([^}]+)\}/.exec(t))) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()!.trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) pushExport(name, 'const', lineNo);
      }
    }
  });

  // File-level docblock: a /** */ at the very top before any code.
  let topDoc: string | undefined;
  const firstDoc = /^\/\*\*([\s\S]*?)\*\//.exec(src.trimStart());
  if (firstDoc) {
    const d = cleanDoc(firstDoc[1]);
    if (d.length > 10) topDoc = d;
  }

  const functionCount = (src.match(/^\s*(export\s+)?(async\s+)?function\s+\w/gm) || []).length +
    (src.match(/=>\s*\{/g) || []).length;
  const classCount = (src.match(/^\s*(export\s+)?class\s+\w/gm) || []).length;
  const commentLines = lines.filter((l) => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  }).length;

  const imports = [...new Set(
    [...src.matchAll(/^\s*import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1])
  )].slice(0, 12);

  const isTsx = /\.(tsx|jsx)$/i.test(fileName);
  const hasJsx = /<[A-Za-z][\w]*[\s>/]/.test(src) || /React\.createElement/.test(src);
  const isReactComponent = isTsx && hasJsx && exports.some((e) => /^[A-Z]/.test(e.name));

  const isApiHandler = /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/.test(src) ||
    /\(req\s*:\s*\w*Request|\(req,\s*res\)/.test(src);
  const apiMethods = [...new Set(
    [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\b/g)].map((m) => m[1])
  )];

  const isTest = /\.(test|spec)\./i.test(fileName) ||
    /^\s*(describe|it|test)\s*\(/m.test(src);

  const isHook = /^use[A-Z]/.test(fileName.split('/').pop() || '') &&
    /export\s+(function|const)\s+use[A-Z]/.test(src);

  return {
    exports: exports.slice(0, 12),
    isReactComponent,
    isApiHandler,
    apiMethods,
    isTest,
    isHook,
    functionCount,
    classCount,
    lineCount: lines.length,
    commentRatio: lines.length ? commentLines / lines.length : 0,
    topDoc,
    imports,
  };
}

/** One-line human summary of what the code does, for narration. */
export function summarizeCode(sig: CodeSignals): string | null {
  if (sig.topDoc) return sig.topDoc;
  // Prefer documented exports.
  const documented = sig.exports.filter((e) => e.doc);
  if (documented.length) {
    const e = documented[0];
    return `${e.name} — ${e.doc}`;
  }
  if (sig.isReactComponent) {
    const comps = sig.exports.filter((e) => /^[A-Z]/.test(e.name)).map((e) => e.name);
    if (comps.length) return `Renders the ${comps.slice(0, 3).join(', ')} UI component${comps.length > 1 ? 's' : ''}`;
  }
  if (sig.isHook) {
    const h = sig.exports.find((e) => /^use[A-Z]/.test(e.name));
    if (h) return `${h.name} — a reusable piece of component logic`;
  }
  if (sig.isApiHandler) {
    return sig.apiMethods.length
      ? `Handles ${sig.apiMethods.join(', ')} API requests`
      : 'Handles API requests';
  }
  if (sig.exports.length) {
    const names = sig.exports.slice(0, 4).map((e) => `\`${e.name}\``).join(', ');
    const more = sig.exports.length > 4 ? ` and ${sig.exports.length - 4} more` : '';
    return `Provides ${names}${more}`;
  }
  return null;
}

/** Enrich a filename-pattern role with code-derived specifics. */
export function enrichRole(base: string, sig: CodeSignals): string {
  const summary = summarizeCode(sig);
  if (summary) return `${base} — specifically, ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`;
  return base;
}
