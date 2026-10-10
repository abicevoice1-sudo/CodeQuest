import { useEffect, useState } from 'react';
import {
  loadFigmaSettings,
  figmaConfigured,
  fetchLinkedFiles,
  matchFramesToFile,
  embedUrlFor,
  extractFileKey,
  type FigmaFile,
} from '../lib/figma';

/** 🎨 Related designs — shows linked Figma files and frames matching this code file. */
export function FigmaDesigns({ filePath }: { filePath: string }) {
  const [files, setFiles] = useState<FigmaFile[] | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [showEmbed, setShowEmbed] = useState<string | null>(null);

  useEffect(() => {
    const s = loadFigmaSettings();
    if (!figmaConfigured(s) || !s.fileUrls.length) { setFiles([]); return; }
    let live = true;
    (async () => {
      const linked = await fetchLinkedFiles(s);
      if (!live) return;
      setFiles(linked);
      // Frame matching needs document trees — fetch per file, best effort.
      const fileName = filePath.split('/').pop() || '';
      const all: string[] = [];
      for (const f of linked) {
        try {
          const r = await fetch(`https://api.figma.com/v1/files/${f.key}`, {
            headers: { 'X-Figma-Token': s.accessToken },
          });
          if (!r.ok) continue;
          const j = await r.json();
          for (const name of matchFramesToFile(j, fileName)) {
            if (!all.includes(name)) all.push(name);
          }
        } catch { /* skip */ }
      }
      if (live) setFrames(all);
    })();
    return () => { live = false; };
  }, [filePath]);

  if (files === null) return null; // loading
  if (!files.length) return null;  // not configured or no links — stay invisible

  return (
    <div className="fd-jira">
      <div className="fd-sec-title">🎨 Designs</div>
      {frames.length > 0 && (
        <p className="modal-sub" style={{ margin: '0 0 8px' }}>
          Matching Figma frames: {frames.map((f) => <code key={f}>{f}</code>).reduce<React.ReactNode[]>(
            (acc, el, i) => (i ? [...acc, ', ', el] : [el]), []
          )}
        </p>
      )}
      <div className="figma-cards">
        {files.map((f) => (
          <div key={f.key} className="figma-card">
            {f.thumbnailUrl && (
              <button
                className="figma-thumb"
                onClick={() => setShowEmbed(showEmbed === f.key ? null : f.key)}
                title="Preview design"
              >
                <img src={f.thumbnailUrl} alt={f.name} loading="lazy" />
              </button>
            )}
            <div className="figma-meta">
              <div className="figma-name">{f.name}</div>
              <div className="figma-actions">
                <button
                  className="ghost small"
                  onClick={() => setShowEmbed(showEmbed === f.key ? null : f.key)}
                >
                  {showEmbed === f.key ? 'Hide preview' : 'Preview'}
                </button>
                <a href={f.url} target="_blank" rel="noreferrer" className="ghost small figma-open">
                  Open in Figma ⤴
                </a>
              </div>
            </div>
            {showEmbed === f.key && (
              <iframe
                className="figma-embed"
                title={`Figma preview — ${f.name}`}
                src={embedUrlFor(f.url, f.key)}
                allowFullScreen
              />
            )}
          </div>
        ))}
      </div>
      <p className="modal-sub" style={{ margin: '6px 0 0' }}>
        Link more files in <b>Settings → Figma</b>.
      </p>
    </div>
  );
}

/** Compact designs strip for the repo guide — business viewers see the product's faces. */
export function FigmaGuideStrip() {
  const [files, setFiles] = useState<FigmaFile[] | null>(null);

  useEffect(() => {
    const s = loadFigmaSettings();
    if (!figmaConfigured(s) || !s.fileUrls.length) { setFiles([]); return; }
    let live = true;
    fetchLinkedFiles(s).then((f) => { if (live) setFiles(f); });
    return () => { live = false; };
  }, []);

  if (!files || !files.length) return null;

  return (
    <div className="guide-figma">
      <h3>🎨 Designs</h3>
      <p className="guide-sub">What this product looks like — straight from Figma.</p>
      <div className="figma-cards">
        {files.map((f) => (
          <a key={f.key} className="figma-card figma-link" href={extractFileKey(f.url) ? f.url : f.url} target="_blank" rel="noreferrer">
            {f.thumbnailUrl && <img src={f.thumbnailUrl} alt={f.name} loading="lazy" className="figma-thumb-img" />}
            <div className="figma-meta">
              <div className="figma-name">{f.name}</div>
              <div className="modal-sub" style={{ margin: 0 }}>Open in Figma ⤴</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
