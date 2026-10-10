import { useState } from 'react';
import { loadAISettings, saveAISettings } from '../lib/ai';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState(loadAISettings());
  const [saved, setSaved] = useState(false);

  const save = () => {
    saveAISettings({ ...s, endpoint: s.endpoint.trim().replace(/\/$/, ''), model: s.model.trim() });
    setSaved(true);
    setTimeout(onClose, 700);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>⚙ AI settings</h3>
        <p className="modal-sub">
          File explanations call an LLM with your own key. The key never leaves your browser
          except to the endpoint below. Any OpenAI-compatible API works.
        </p>
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
      </div>
    </div>
  );
}
