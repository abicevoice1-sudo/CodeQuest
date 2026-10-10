import { useState } from 'react';
import { loadAISettings, saveAISettings } from '../lib/ai';
import { THEMES, type ThemeId } from '../lib/theme';

interface EnvMatch { key: string; score: number; masked: string; }

export function SettingsModal({
  onClose,
  serverMode,
  theme,
  setTheme,
}: {
  onClose: () => void;
  serverMode: boolean;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}) {
  const [s, setS] = useState(loadAISettings());
  const [saved, setSaved] = useState(false);
  const [permAsk, setPermAsk] = useState(false);
  const [matches, setMatches] = useState<EnvMatch[] | null>(null);
  const [envError, setEnvError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const save = () => {
    saveAISettings({ ...s, endpoint: s.endpoint.trim().replace(/\/$/, ''), model: s.model.trim() });
    setSaved(true);
    setTimeout(onClose, 700);
  };

  const scanEnv = async () => {
    setEnvError('');
    setPermAsk(false);
    if (!serverMode) { setEnvError('Live .env reading needs the local server — run `codequest start`.'); return; }
    try {
      const r = await fetch('/api/env-scan?kind=ai');
      const j = await r.json();
      setMatches(j.matches || []);
      if (!(j.matches || []).length) setEnvError('No API-key variables found in .env — tried fuzzy matching on every key.');
    } catch {
      setEnvError('Could not read .env from the local server.');
    }
  };

  const useMatch = (m: EnvMatch) => {
    navigator.clipboard?.writeText(m.key).catch(() => {});
    setCopiedKey(m.key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>⚙ Settings</h3>

        <h4 className="modal-sec">Appearance</h4>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-opt${theme === t.id ? ' on' : ''}`}
              onClick={() => setTheme(t.id)}
            >
              <span className="theme-swatch" data-swatch={t.id} />
              <span className="prof-opt-name">{t.label}</span>
              <span className="prof-opt-hint">{t.hint}</span>
            </button>
          ))}
        </div>

        <h4 className="modal-sec">AI explain</h4>
        <p className="modal-sub">
          File explanations call an LLM with your own key. The key never leaves your browser
          except to the endpoint below. Any OpenAI-compatible API works.
        </p>
        <button className="ghost small" onClick={() => setPermAsk(true)} style={{ marginBottom: 10 }}>
          📥 Import key from .env
        </button>
        {envError && <p className="guide-err">{envError}</p>}
        {matches && matches.length > 0 && (
          <div className="guide-envmatches" style={{ marginBottom: 10 }}>
            {matches.map((m) => (
              <div className="guide-envmatch" key={m.key}>
                <code>{m.key}</code>
                <span className="guide-masked">{m.masked}</span>
                <button className="guide-copy" onClick={() => useMatch(m)}>
                  {copiedKey === m.key ? '✓ name copied' : 'Copy name'}
                </button>
              </div>
            ))}
            <p className="modal-sub">Copy the real value from your .env into the key field below — only masked previews are shown here.</p>
          </div>
        )}
        <label>Endpoint
          <input value={s.endpoint} onChange={(e) => setS({ ...s, endpoint: e.target.value })} placeholder="https://api.openai.com/v1" />
        </label>
        <label>API key
          <input type="password" value={s.apiKey} onChange={(e) => setS({ ...s, apiKey: e.target.value })} placeholder="sk-…" />
        </label>
        <label>Model
          <input value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder="gpt-4o-mini" />
        </label>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
        </div>
        {permAsk && (
          <div className="guide-perm-backdrop" onClick={() => setPermAsk(false)}>
            <div className="guide-perm" onClick={(e) => e.stopPropagation()}>
              <h3>🔑 Read your .env file?</h3>
              <p>
                CodeQuest wants to read <code>.env</code> in this repo to find API keys —
                using fuzzy matching across every variable name. Only masked previews are
                ever shown; secrets never leave this machine.
              </p>
              <div className="guide-perm-actions">
                <button className="ghost-btn guide-btn" onClick={() => setPermAsk(false)}>Cancel</button>
                <button className="guide-btn" onClick={scanEnv}>Allow — scan .env</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
