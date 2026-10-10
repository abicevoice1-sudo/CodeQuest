import { useEffect, useMemo, useState } from 'react';
import { loadAISettings, saveAISettings } from '../lib/ai';
import { getVoices, groupVoices, loadVoiceSettings, saveVoiceSettings, speak } from '../lib/voice';
import { loadJiraSettings, saveJiraSettings, testJiraConnection, jiraConfigured } from '../lib/jira';
import { loadFigmaSettings, saveFigmaSettings, testFigmaConnection, figmaConfigured, extractFileKey } from '../lib/figma';
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
  const [vs, setVs] = useState(loadVoiceSettings());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [js, setJs] = useState(loadJiraSettings());
  const [jiraTest, setJiraTest] = useState('');
  const [jiraTesting, setJiraTesting] = useState(false);
  const [fs, setFs] = useState(loadFigmaSettings());
  const [figmaTest, setFigmaTest] = useState('');
  const [figmaTesting, setFigmaTesting] = useState(false);

  useEffect(() => { getVoices().then(setVoices); }, []);
  const voiceGroups = useMemo(() => groupVoices(voices), [voices]);

  const save = () => {
    saveAISettings({ ...s, endpoint: s.endpoint.trim().replace(/\/$/, ''), model: s.model.trim() });
    saveVoiceSettings(vs);
    saveJiraSettings({ ...js, url: js.url.trim().replace(/\/$/, '') });
    saveFigmaSettings({ accessToken: fs.accessToken.trim(), fileUrls: fs.fileUrls.map((u) => u.trim()).filter(Boolean) });
    setSaved(true);
    setTimeout(onClose, 700);
  };

  const previewVoice = () => {
    saveVoiceSettings(vs);
    speak('Hello! This is how I will sound when I explain your code.');
  };

  const testJira = async () => {
    setJiraTesting(true);
    setJiraTest('');
    try {
      const name = await testJiraConnection({ ...js, url: js.url.trim().replace(/\/$/, '') });
      setJiraTest(`✓ Connected as ${name}`);
    } catch (e) {
      setJiraTest(`✗ ${e instanceof Error ? e.message : 'Connection failed.'}`);
    }
    setJiraTesting(false);
  };

  const testFigma = async () => {
    setFigmaTesting(true);
    setFigmaTest('');
    try {
      const name = await testFigmaConnection({ ...fs, accessToken: fs.accessToken.trim() });
      const keys = fs.fileUrls.map(extractFileKey).filter(Boolean);
      setFigmaTest(`✓ Connected as ${name}${keys.length ? ` · ${keys.length} design file${keys.length === 1 ? '' : 's'} linked` : ' · no design files linked yet'}`);
    } catch (e) {
      setFigmaTest(`✗ ${e instanceof Error ? e.message : 'Connection failed.'}`);
    }
    setFigmaTesting(false);
  };

  const pickVoice = (uri: string) => {
    const next = { ...vs, voiceURI: uri };
    setVs(next);
    // Live preview so you hear each voice as you browse.
    saveVoiceSettings(next);
    speak('This is my voice.');
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

        <h4 className="modal-sec">Voice</h4>
        <p className="modal-sub">
          The voice that reads explanations aloud. Free, on-device — no API key needed.
        </p>
        <label>Voice
          <select
            value={vs.voiceURI}
            onChange={(e) => pickVoice(e.target.value)}
          >
            <option value="">★ Best available (auto)</option>
            {voiceGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}{v.localService ? '' : ' · network'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {!voices.length && (
          <p className="modal-sub">Loading system voices…</p>
        )}
        <label>Speed: {vs.rate.toFixed(2)}×
          <input
            type="range" min={0.5} max={2} step={0.05}
            value={vs.rate}
            onChange={(e) => setVs({ ...vs, rate: parseFloat(e.target.value) })}
          />
        </label>
        <label>Pitch: {vs.pitch.toFixed(2)}
          <input
            type="range" min={0} max={2} step={0.05}
            value={vs.pitch}
            onChange={(e) => setVs({ ...vs, pitch: parseFloat(e.target.value) })}
          />
        </label>
        <button className="ghost small" onClick={previewVoice} style={{ marginBottom: 10 }}>
          🔊 Preview voice
        </button>

        <h4 className="modal-sec">Jira — business context</h4>
        <p className="modal-sub">
          Connect Jira to link code to tickets. Business people see <em>why</em> a file
          exists; devs see the story, priority, and who's waiting on it. Credentials stay in your browser.
        </p>
        <label>Jira URL
          <input value={js.url} onChange={(e) => setJs({ ...js, url: e.target.value })} placeholder="https://yourcompany.atlassian.net" />
        </label>
        <label>Email
          <input value={js.email} onChange={(e) => setJs({ ...js, email: e.target.value })} placeholder="you@company.com" />
        </label>
        <label>API token
          <input type="password" value={js.apiToken} onChange={(e) => setJs({ ...js, apiToken: e.target.value })} placeholder="Create at Atlassian → Account → Security" />
        </label>
        <label>Project key <span className="modal-opt">(optional)</span>
          <input value={js.projectKey} onChange={(e) => setJs({ ...js, projectKey: e.target.value.toUpperCase() })} placeholder="PROJ" />
        </label>
        <button className="ghost small" onClick={testJira} disabled={jiraTesting} style={{ marginBottom: 10 }}>
          {jiraTesting ? 'Testing…' : jiraConfigured(js) ? '🔗 Test connection' : '🔗 Connect Jira'}
        </button>
        {jiraTest && <p className="modal-sub">{jiraTest}</p>}

        <h4 className="modal-sec">Figma — design context</h4>
        <p className="modal-sub">
          Attach Figma design files so anyone viewing the code can see the designs
          too — business people see what the product looks like, devs see which
          frames match the file they're reading. Token stays in your browser.
        </p>
        <label>Personal access token
          <input type="password" value={fs.accessToken} onChange={(e) => setFs({ ...fs, accessToken: e.target.value })} placeholder="Create at Figma → Settings → Personal access tokens" />
        </label>
        <label>Design file URLs <span className="modal-opt">(one per line)</span>
          <textarea
            value={fs.fileUrls.join('\n')}
            onChange={(e) => setFs({ ...fs, fileUrls: e.target.value.split('\n') })}
            placeholder={'https://www.figma.com/design/AbC123/My-App\nhttps://www.figma.com/design/XyZ789/Admin-Panel'}
            rows={3}
            className="figma-urls"
          />
        </label>
        <button className="ghost small" onClick={testFigma} disabled={figmaTesting} style={{ marginBottom: 10 }}>
          {figmaTesting ? 'Testing…' : figmaConfigured(fs) ? '🎨 Test connection' : '🎨 Connect Figma'}
        </button>
        {figmaTest && <p className="modal-sub">{figmaTest}</p>}

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
