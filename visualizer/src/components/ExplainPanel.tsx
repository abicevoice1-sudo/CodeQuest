import { useEffect, useRef, useState } from 'react';
import { explainFile, loadAISettings, mdToHtml, type ExplainContext } from '../lib/ai';

export function ExplainPanel({
  ctx,
  autoRunKey,
  onNeedSettings,
}: {
  ctx: ExplainContext;
  autoRunKey: number;
  onNeedSettings: () => void;
}) {
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lastKey = useRef(0);

  const run = async () => {
    setBusy(true);
    setErr('');
    setOut('');
    try {
      const s = loadAISettings();
      if (!s.apiKey) {
        onNeedSettings();
        setErr('Add your API key in Settings first — it stays in your browser.');
        return;
      }
      const text = await explainFile(ctx, s);
      setOut(text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Explanation failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (autoRunKey > 0 && autoRunKey !== lastKey.current) {
      lastKey.current = autoRunKey;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunKey]);

  // reset when switching files
  useEffect(() => {
    setOut('');
    setErr('');
  }, [ctx.path, ctx.code]);

  return (
    <div className="explain">
      {!out && !busy && (
        <button className="explain-btn" onClick={run} disabled={busy}>
          ✨ Explain this file
        </button>
      )}
      {busy && <div className="explain-busy"><span className="spinner" /> Reading the code…</div>}
      {err && <div className="explain-err">{err}</div>}
      {out && (
        <>
          <div className="explain-out" dangerouslySetInnerHTML={{ __html: mdToHtml(out) }} />
          <button className="ghost small" onClick={run}>↻ Explain again</button>
        </>
      )}
      <p className="explain-note">Uses your own API key (Settings ⚙). Any OpenAI-compatible endpoint works.</p>
    </div>
  );
}
