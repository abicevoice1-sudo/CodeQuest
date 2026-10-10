import { useEffect, useRef, useState } from 'react';
import { highlightCode } from '../lib/highlight';

export function CodePanel({ path, code, loadError, focusLine }: { path: string; code: string | null; loadError: string; focusLine?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusLine && ref.current && code) {
      const el = ref.current.querySelector(`.cl:nth-child(${focusLine})`);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('flash');
        const t = setTimeout(() => el.classList.remove('flash'), 1800);
        return () => clearTimeout(t);
      }
    }
  }, [path, code, focusLine]);
  if (loadError) return <div className="code-hint">{loadError}</div>;
  if (code === null) return <div className="code-hint">Loading {path}…</div>;
  return (
    <div ref={ref} className="codeview" dangerouslySetInnerHTML={{ __html: highlightCode(code, path) }} />
  );
}

/** Fetch the selected file's source once; shared by Code + Explain tabs.
    Prefers embedded sources (standalone export), falls back to the live server. */
export function useFileCode(path: string | null): { code: string | null; loadError: string } {
  const [code, setCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    if (!path) { setCode(null); setLoadError(''); return; }
    const embedded = (window as unknown as { __CODEQUEST_FILES__?: Record<string, string> }).__CODEQUEST_FILES__?.[path];
    if (embedded != null) { setCode(embedded); setLoadError(''); return; }
    let live = true;
    setCode(null);
    setLoadError('');
    fetch(`/api/file?path=${encodeURIComponent(path)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((t) => { if (live) setCode(t); })
      .catch(() => {
        if (live) setLoadError('Code view needs the live server — run `codequest start` in your repo.');
      });
    return () => { live = false; };
  }, [path]);
  return { code, loadError };
}
