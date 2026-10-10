import { RISK_COLORS, shortName, type GraphEdge, type GraphModule } from '../types';
import { CodePanel } from './CodePanel';
import { ExplainPanel } from './ExplainPanel';
import type { ExplainContext } from '../lib/ai';
import type { Narration } from '../lib/narrate';

/** Split view for a selected file: info on the left, code on the right. */
export function FileDetail({
  module,
  narration,
  detailTab,
  setDetailTab,
  onBack,
  onListen,
  onBlast,
  onSelectFile,
  downstream,
  upstream,
  code,
  loadError,
  explainCtx,
  onNeedSettings,
}: {
  module: GraphModule;
  narration: Narration | null;
  detailTab: 'info' | 'explain';
  setDetailTab: (t: 'info' | 'explain') => void;
  onBack: () => void;
  onListen: () => void;
  onBlast: () => void;
  onSelectFile: (id: string) => void;
  downstream: GraphEdge[];
  upstream: GraphEdge[];
  code: string | null;
  loadError: string;
  explainCtx: ExplainContext | null;
  onNeedSettings: () => void;
}) {
  const inVsCode = !!(window as unknown as { acquireVsCodeApi?: unknown }).acquireVsCodeApi;
  return (
    <div className="file-detail">
      <div className="fd-header">
        <button className="ghost small" onClick={onBack} title="Back to graph">← Graph</button>
        <span className="fd-path" title={module.path}>📄 {module.path}</span>
        <button className="ghost small" title="Listen: hear this file's purpose and impact" onClick={onListen}>
          🔊
        </button>
      </div>
      <div className="fd-split">
        <div className="fd-info">
          <div className="fd-tabs">
            <button className={detailTab === 'info' ? 'on' : ''} onClick={() => setDetailTab('info')}>Info</button>
            <button className={detailTab === 'explain' ? 'on' : ''} onClick={() => setDetailTab('explain')}>✨ Explain</button>
          </div>
          {detailTab === 'explain' ? (
            explainCtx ? (
              <ExplainPanel ctx={explainCtx} autoRunKey={0} onNeedSettings={onNeedSettings} />
            ) : (
              <div className="code-hint">Select a file first.</div>
            )
          ) : (
            <>
              {narration && (
                <div className="narration">
                  <p><b>Purpose.</b> {narration.purpose}</p>
                  <p><b>Impact.</b> {narration.impact}</p>
                </div>
              )}
              <div className="detail-meta">
                <span className="risk-badge" style={{ background: RISK_COLORS[module.risk || 'LOW'] }}>
                  {module.risk || 'LOW'}
                </span>
                <span className="layer-badge">{module.layer}</span>
                {module.isEntry && <span className="entry-badge">ENTRY</span>}
              </div>
              <div className="detail-stats">
                <div><b>{module.lines}</b><span>lines</span></div>
                <div><b>{module.fanIn}</b><span>dependents</span></div>
                <div><b>{module.fanOut}</b><span>dependencies</span></div>
              </div>
              <button className="blast-btn" onClick={onBlast}>◉ Show blast radius</button>
              {inVsCode && (
                <button
                  className="ghost small"
                  style={{ width: '100%', marginBottom: 16 }}
                  onClick={() =>
                    (window as unknown as { acquireVsCodeApi: () => { postMessage: (m: unknown) => void } })
                      .acquireVsCodeApi()
                      .postMessage({ command: 'openFile', path: module.path })
                  }
                >
                  Open in editor ⤴
                </button>
              )}
              {module.exports.length > 0 && (
                <>
                  <h4>Exports ({module.exports.length})</h4>
                  <div className="tags">{module.exports.slice(0, 24).map((e) => <code key={e}>{e}</code>)}</div>
                </>
              )}
              {downstream.length > 0 && (
                <>
                  <h4>Imports ({downstream.length})</h4>
                  <div className="edge-list">
                    {downstream.map((e) => (
                      <button key={e.from + e.to} onClick={() => onSelectFile(e.to)} title={e.to}>
                        {shortName(e.to)}{e.line ? <span className="line">:{e.line}</span> : null}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {upstream.length > 0 && (
                <>
                  <h4>Imported by ({upstream.length})</h4>
                  <div className="edge-list">
                    {upstream.map((e) => (
                      <button key={e.to + e.from} onClick={() => onSelectFile(e.from)} title={e.from}>
                        {shortName(e.from)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="fd-code">
          <CodePanel path={module.id} code={code} loadError={loadError} />
        </div>
      </div>
    </div>
  );
}
