/* Tiny syntax highlighter — zero dependencies. Returns HTML with spans. */

const KEYWORDS_C = new Set(
  'break case catch class const constructor continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await enum implements interface private protected public readonly abstract as type namespace require module declare'.split(' ')
);
const KEYWORDS_PY = new Set(
  'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None'.split(' ')
);
const TYPES = new Set(
  'string number boolean void null undefined int float double char byte short long void var val def'.split(' ')
);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function langOf(path: string): 'c' | 'py' | 'plain' {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['py'].includes(ext)) return 'py';
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'java', 'go', 'rs', 'php', 'rb', 'c', 'h', 'cpp', 'cs', 'swift', 'kt'].includes(ext)) return 'c';
  return 'plain';
}

/** Highlight one line. Order matters: comments/strings first via tokenization. */
export function highlightLine(line: string, lang: 'c' | 'py' | 'plain'): string {
  if (lang === 'plain') return esc(line);
  const commentRe = lang === 'py' ? /#.*$/ : /\/\/.*$/;
  let code = line;
  let comment = '';
  const cm = code.match(commentRe);
  // naive: ignore # or // inside strings — good enough for a viewer
  if (cm && !isInsideString(code, cm.index || 0)) {
    comment = cm[0];
    code = code.slice(0, cm.index);
  }
  // strings, numbers, keywords, types — single pass
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d[\d_]*(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  const kw = lang === 'py' ? KEYWORDS_PY : KEYWORDS_C;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const tok = m[1];
    if (/^["'`]/.test(tok)) out += `<span class="tk-str">${esc(tok)}</span>`;
    else if (/^\d/.test(tok)) out += `<span class="tk-num">${esc(tok)}</span>`;
    else if (kw.has(tok)) out += `<span class="tk-kw">${esc(tok)}</span>`;
    else if (TYPES.has(tok)) out += `<span class="tk-type">${esc(tok)}</span>`;
    else out += esc(tok);
    last = m.index + tok.length;
  }
  out += esc(code.slice(last));
  if (comment) out += `<span class="tk-com">${esc(comment)}</span>`;
  return out || '&nbsp;';
}

function isInsideString(code: string, idx: number): boolean {
  let q: string | null = null;
  for (let i = 0; i < idx; i++) {
    const c = code[i];
    if (q) {
      if (c === '\\') i++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'" || c === '`') q = c;
  }
  return q !== null;
}

export function highlightCode(code: string, path: string): string {
  const lang = langOf(path);
  return code
    .split('\n')
    .map((line, i) => `<div class="cl"><span class="ln">${i + 1}</span><span class="lc">${highlightLine(line, lang)}</span></div>`)
    .join('');
}
