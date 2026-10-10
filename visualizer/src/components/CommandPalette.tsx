import { useEffect, useMemo, useRef, useState } from 'react';
import { fuzzySearch } from '../lib/search';
import { shortName, type CodeQuestGraph } from '../types';

export interface PaletteHit {
  id: string;
  kind: 'file' | 'symbol' | 'content';
  label: string;
  sub: string;
  line?: number;
}

const RECENT_KEY = 'codequest.recent';
const MAX_RECENT = 8;

export function getRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function recordRecent(id: string): void {
  try {
    const next = [id, ...getRecents().filter((x) => x !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

function embeddedFiles(): Record<string, string> | null {
  try {
    return (window as unknown as { __CODEQUEST_FILES__?: Record<string, string> }).__CODEQUEST_FILES__ || null;
  } catch {
    return null;
  }
}

const KIND_ICON: Record<PaletteHit['kind'], string> = {
  file: '📄',
  symbol: '🔣',
  content: '📝',
};

const KIND_TITLE: Record<PaletteHit['kind'], string> = {
  file: 'Files',
  symbol: 'Symbols',
  content: 'Code',
};

export function CommandPalette({
  graph,
  open,
  onClose,
  onSelect,
}: {
  graph: CodeQuestGraph;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string, line?: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const hits: PaletteHit[] = useMemo(() => {
    const q = query.trim();
    const out: PaletteHit[] = [];
    if (!q) {
      // Recents when the box is empty.
      const ids = new Set(graph.modules.map((m) => m.id));
      for (const id of getRecents()) {
        if (ids.has(id)) out.push({ id, kind: 'file', label: shortName(id), sub: id });
        if (out.length >= 5) break;
      }
      return out;
    }
    // Files — fuzzy path match.
    const files = fuzzySearch(q, graph.modules.map((m) => m.id)).slice(0, 8);
    for (const f of files) out.push({ id: f.id, kind: 'file', label: shortName(f.id), sub: f.id });

    // Symbols — export names.
    if (q.length >= 2) {
      const ql = q.toLowerCase();
      let n = 0;
      for (const m of graph.modules) {
        for (const ex of m.exports || []) {
          if (ex.toLowerCase().includes(ql)) {
            out.push({ id: m.id, kind: 'symbol', label: ex, sub: shortName(m.id) });
            if (++n >= 6) break;
          }
        }
        if (n >= 6) break;
      }
    }

    // Code content — only when sources are embedded (exported report).
    if (q.length >= 3) {
      const filesMap = embeddedFiles();
      if (filesMap) {
        const ql = q.toLowerCase();
        let n = 0;
        for (const m of graph.modules) {
          const src = filesMap[m.id];
          if (!src) continue;
          const lines = src.split('\n');
          for (let i = 0; i < lines.length && n < 24; i++) {
            const line = lines[i];
            const idx = line.toLowerCase().indexOf(ql);
            if (idx >= 0) {
              const start = Math.max(0, idx - 40);
              out.push({
                id: m.id,
                kind: 'content',
                label: `${shortName(m.id)}:${i + 1}`,
                sub: (start > 0 ? '…' : '') + line.slice(start, start + 90).trim() + '…',
                line: i + 1,
              });
              n++;
              break; // one hit per file keeps the list scannable
            }
          }
          if (n >= 24) break;
        }
      }
    }
    return out;
  }, [graph, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active ]);

  if (!open) return null;

  const go = (h: PaletteHit) => {
    recordRecent(h.id);
    onSelect(h.id, h.line);
    onClose();
  };

  // Group consecutive hits by kind for section headers.
  const sections: { kind: PaletteHit['kind']; hits: PaletteHit[] }[] = [];
  for (const h of hits) {
    const last = sections[sections.length - 1];
    if (last && last.kind === h.kind) last.hits.push(h);
    else sections.push({ kind: h.kind, hits: [h] });
  }
  let flatIdx = -1;
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input-row">
          <span className="palette-icon">🔍</span>
          <input
            ref={inputRef}
            value={query}
            placeholder="Search files, symbols, code…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter') { const h = hits[active]; if (h) go(h); }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {hits.length === 0 && (
            <div className="palette-empty">
              {query.trim() ? `No matches for “${query.trim()}”.` : 'No recent files yet — open a file and it’ll show up here.'}
            </div>
          )}
          {sections.map((s) => (
            <div key={s.kind}>
              <div className="palette-group">{KIND_TITLE[s.kind]}</div>
              {s.hits.map((h) => {
                flatIdx++;
                const i = flatIdx;
                return (
                  <button
                    key={`${h.id}-${h.line || 0}-${i}`}
                    data-idx={i}
                    className={`palette-hit${i === active ? ' on' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                  >
                    <span className="palette-kind">{KIND_ICON[h.kind]}</span>
                    <span className="palette-label">{h.label}</span>
                    <span className="palette-sub" title={h.sub}>{h.sub}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span className="palette-hint">⌘K anywhere</span>
        </div>
      </div>
    </div>
  );
}
