import { useState } from 'react';
import { LAYER_COLORS, RISK_COLORS, type Risk } from '../types';

export interface FilterState {
  layers: Set<string>;
  risks: Set<string>;
  hideTests: boolean;
  hideAssets: boolean;
}

export function FilterPanel({
  allLayers,
  layerCounts,
  f,
  onChange,
}: {
  allLayers: string[];
  layerCounts: Record<string, number>;
  f: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggleLayer = (l: string) => {
    const next = new Set(f.layers);
    if (next.has(l)) next.delete(l);
    else next.add(l);
    onChange({ ...f, layers: next });
  };
  const toggleRisk = (r: string) => {
    const next = new Set(f.risks);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    onChange({ ...f, risks: next });
  };
  const activeCount =
    (allLayers.length - f.layers.size) +
    (4 - f.risks.size) +
    (f.hideTests ? 1 : 0) +
    (f.hideAssets ? 1 : 0);
  const reset = () =>
    onChange({
      layers: new Set(allLayers),
      risks: new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
      hideTests: false,
      hideAssets: false,
    });

  return (
    <div className="fpanel">
      <button className="fpanel-head" onClick={() => setOpen((o) => !o)}>
        <span className="fpanel-title">
          <span className="ft-caret">{open ? '▾' : '▸'}</span> ◈ Filters
          {activeCount > 0 && <span className="fpanel-badge">{activeCount}</span>}
        </span>
        {activeCount > 0 && (
          <span
            className="fpanel-reset"
            onClick={(e) => { e.stopPropagation(); reset(); }}
          >
            Reset
          </span>
        )}
      </button>
      {open && (
        <>
      <div className="fpanel-presets">
        <button
          className="fpanel-preset"
          onClick={() => onChange({ ...f, hideTests: true, hideAssets: true })}
          title="Hide tests, configs and assets — code only"
        >
          Code only
        </button>
        <button
          className="fpanel-preset"
          onClick={() => onChange({ ...f, risks: new Set(['CRITICAL', 'HIGH']) })}
          title="Show only the riskiest files"
        >
          🔥 Hotspots
        </button>
        <button
          className="fpanel-preset"
          onClick={reset}
          title="Show everything"
        >
          Show all
        </button>
      </div>
      <section>
        <h3>Layers</h3>
        <div className="chips">
          {allLayers.map((l) => (
            <button
              key={l}
              className={`chip${f.layers.has(l) ? ' on' : ''}`}
              onClick={() => toggleLayer(l)}
            >
              <span className="dot" style={{ background: LAYER_COLORS[l] || '#94a3b8' }} />
              {l}
              <span className="chip-count">{layerCounts[l] || 0}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Risk</h3>
        <div className="chips">
          {(Object.keys(RISK_COLORS) as Risk[]).map((r) => (
            <button
              key={r}
              className={`chip${f.risks.has(r) ? ' on' : ''}`}
              onClick={() => toggleRisk(r)}
            >
              <span className="dot" style={{ background: RISK_COLORS[r] }} />
              {r}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Show</h3>
        <label className="toggle">
          <input type="checkbox" checked={!f.hideTests} onChange={() => onChange({ ...f, hideTests: !f.hideTests })} />
          Test files
        </label>
        <label className="toggle">
          <input type="checkbox" checked={!f.hideAssets} onChange={() => onChange({ ...f, hideAssets: !f.hideAssets })} />
          Configs & assets
        </label>
      </section>
        </>
      )}
    </div>
  );
}
