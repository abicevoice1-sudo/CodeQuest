import { useEffect, useState } from 'react';
import { highlightCode } from '../lib/highlight';

export function CodePanel({ path, code, loadError }: { path: string; code: string | null; loadError: string }) {
  if (loadError) return <div className="code-hint">{loadError}</div>;
  if (code === null) return <div className="code-hint">Loading {path}…</div>;
  return (
    <div className="codeview" dangerouslySetInnerHTML={{ __html: highlightCode(code, path) }} />
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
