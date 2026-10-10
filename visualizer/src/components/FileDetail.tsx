import { useState } from 'react';
import { RISK_COLORS, shortName, type GraphEdge, type GraphModule } from '../types';
import { langOf } from '../lib/highlight';
import { CodePanel } from './CodePanel';
import { ExplainPanel } from './ExplainPanel';
import type { ExplainContext } from '../lib/ai';
import type { Narration } from '../lib/narrate';

const LANG_LABEL: Record<string, string> = {
  c: 'JS/TS', py: 'Python', plain: 'Text',
};

/** Split view for a selected file: about the file on the left, code on the right. */
export function FileDetail({
  module,
  narration,
  detailTab,
  setDetailTab,
  onBack,
  onListen,
  onBlast,
  onDiagram,
  onSelectFile,
  downstream,
  upstream,
  code,
  loadError,
  focusLine,
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
  onDiagram: () => void;
  onSelectFile: (id: string) => void;
  downstream: GraphEdge[];
  upstream: GraphEdge[];
  code: string | null;
  loadError: string;
  focusLine?: number;
  explainCtx: ExplainContext | null;
  onNeedSettings: () => void;
}) {
  const [mobileTab, setMobileTab] = useState<'about' | 'code'>('about');
  const [copied, setCopied] = useState(false);
  const inVsCode = !!(window as unknown as { acquireVsCodeApi?: unknown }).acquireVsCodeApi;

  const parts = module.path.split('/');
  const fileName = parts[parts.length - 1];
  const dir = parts.slice(0, -1).join('/');
  const lang = LANG_LABEL[langOf(module.path)] || 'Text';

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="file-detail">
      <div className="fd-header">
        <button className="fd-back" onClick={onBack} title="Back to graph">←</button>
        <div className="fd-title">
          <div className="fd-breadcrumb" title={module.path}>
            {dir && <span className="fd-dir">{dir}/</span>}
            <span className="fd-file">{fileName}</span>
          </div>
          <div className="fd-badges">
            <span className="risk-badge" style={{ background: RISK_COLORS[module.risk || 'LOW'] }}>
              {module.risk || 'LOW'}
            </span>
            <span className="layer-badge">{module.layer}</span>
            {module.isEntry && <span className="entry-badge">ENTRY</span>}
            <span className="lang-badge">{lang}</span>
          </div>
        </div>
        <div className="fd-actions">
          <button className="fd-icon-btn" title="Listen: hear this file's purpose and impact" onClick={onListen}>🔊</button>
          <button className="fd-icon-btn" title="Diagram: this file and its connections" onClick={onDiagram}>◈</button>
          <button className="fd-icon-btn" title="Show blast radius" onClick={onBlast}>◉</button>
        </div>
      </div>

      <div className="fd-mobile-tabs">
        <button className={mobileTab === 'about' ? 'on' : ''} onClick={() => setMobileTab('about')}>About</button>
        <button className={mobileTab === 'code' ? 'on' : ''} onClick={() => setMobileTab('code')}>Code</button>
      </div>

      <div className={`fd-split ${mobileTab === 'about' ? 'show-about' : 'show-code'}`}>
        <div className="fd-info">
          <div className="fd-tabs">
            <button className={detailTab === 'info' ? 'on' : ''} onClick={() => setDetailTab('info')}>About this file</button>
            <button className={detailTab === 'explain' ? 'on' : ''} onClick={() => setDetailTab('explain')}>✨ AI explain</button>
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
                <div className="fd-summary">
                  <div className="fd-summary-row">
                    <span className="fd-summary-label">What it does</span>
                    <p>{narration.purpose}</p>
                  </div>
                  <div className="fd-summary-row">
                    <span className="fd-summary-label">If you change it</span>
                    <p>{narration.impact}</p>
                  </div>
                </div>
              )}
              <div className="fd-stats">
                <div className="fd-stat"><b>{module.lines}</b><span>lines</span></div>
                <div className="fd-stat"><b>{module.fanIn}</b><span>dependents</span></div>
                <div className="fd-stat"><b>{module.fanOut}</b><span>imports</span></div>
              </div>
              <button className="fd-blast" onClick={onBlast}>
                <span>◉</span> Blast radius
                <span className="fd-blast-hint">see what breaks</span>
              </button>
              {inVsCode && (
                <button
                  className="ghost small"
                  style={{ width: '100%', marginBottom: 14 }}
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
                <div className="fd-section">
                  <h4>Exports <span className="fd-count">{module.exports.length}</span></h4>
                  <div className="fd-chips">{module.exports.slice(0, 24).map((e) => <code key={e}>{e}</code>)}</div>
                </div>
              )}
              {downstream.length > 0 && (
                <div className="fd-section">
                  <h4>Imports <span className="fd-count">{downstream.length}</span></h4>
                  <div className="fd-links">
                    {downstream.map((e) => (
                      <button key={e.from + e.to} onClick={() => onSelectFile(e.to)} title={e.to}>
                        <span className="fd-link-name">{shortName(e.to)}</span>
                        {e.line ? <span className="fd-link-line">:{e.line}</span> : null}
                        <span className="fd-link-go">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {upstream.length > 0 && (
                <div className="fd-section">
                  <h4>Imported by <span className="fd-count">{upstream.length}</span></h4>
                  <div className="fd-links">
                    {upstream.map((e) => (
                      <button key={e.to + e.from} onClick={() => onSelectFile(e.from)} title={e.from}>
                        <span className="fd-link-name">{shortName(e.from)}</span>
                        <span className="fd-link-go">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="fd-code">
          <div className="fd-code-header">
            <span className="fd-code-name" title={module.path}>{fileName}</span>
            <span className="fd-code-meta">{module.lines} lines · {lang}</span>
            <button className={`fd-copy${copied ? ' ok' : ''}`} onClick={copyCode} disabled={!code}>
              {copied ? '✓ Copied' : '⧉ Copy'}
            </button>
          </div>
          <div className="fd-code-body">
            <CodePanel path={module.id} code={code} loadError={loadError} focusLine={focusLine} />
          </div>
        </div>
      </div>
    </div>
  );
}
