/* Voice control for the code explorer — Web Speech API, zero cost.
   Commands: "find <q>", "explain <file|this file>", "blast radius <file|this file>", "clear". */

export type VoiceCommand =
  | { kind: 'find'; query: string }
  | { kind: 'explain'; target: string | null }
  | { kind: 'blast'; target: string | null }
  | { kind: 'clear' }
  | { kind: 'unknown'; text: string };

const FILLER = new Set(['the', 'a', 'an', 'file', 'files', 'for', 'me', 'please', 'called', 'named']);

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const t = transcript.toLowerCase().trim().replace(/[?.!,]+$/g, '');
  const clean = (s: string) =>
    s.split(/\s+/).filter((w) => !FILLER.has(w)).join(' ').trim();

  if (/^(clear|reset|stop)$/.test(t)) return { kind: 'clear' };
  let m = t.match(/^(?:hey|ok|please)?\s*(find|search|look for|show me)\s+(.+)$/);
  if (m) {
    const q = clean(m[2]);
    return q ? { kind: 'find', query: q } : { kind: 'unknown', text: transcript };
  }
  m = t.match(/^explain\s+(.+)$/);
  if (m) {
    const tgt = clean(m[1]);
    const isSelf = /^(this|it|that|selected|current)/.test(tgt);
    return { kind: 'explain', target: isSelf || !tgt ? null : tgt };
  }
  m = t.match(/^(?:what is the )?blast radius(?: of)?\s+(.+)$/);
  if (m) {
    const tgt = clean(m[1]);
    const isSelf = /^(this|it|that|selected|current)/.test(tgt);
    return { kind: 'blast', target: isSelf || !tgt ? null : tgt };
  }
  return { kind: 'unknown', text: transcript };
}

/** Fuzzy-match a spoken target against module ids. Returns best match or null. */
export function resolveTarget(target: string, ids: string[]): string | null {
  const q = target.toLowerCase().replace(/\s+/g, '');
  if (!q) return null;
  const scored: Array<[number, string]> = [];
  for (const id of ids) {
    const low = id.toLowerCase();
    const base = low.split('/').pop() || '';
    const nospace = low.replace(/[\s/_.-]/g, '');
    const qns = q.replace(/[\s/_.-]/g, '');
    let score = -1;
    if (low === q || base === q) score = 100;
    else if (low.endsWith('/' + q) || base.startsWith(q)) score = 80;
    else if (low.includes(q)) score = 60;
    else if (nospace.includes(qns) && qns.length >= 3) score = 40;
    if (score > 0) scored.push([score, id]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].length - b[1].length);
  return scored.length ? scored[0][1] : null;
}

export interface VoiceSettings {
  voiceURI: string; // '' = system default
  rate: number;     // 0.5 – 2
  pitch: number;    // 0 – 2
}

const VOICE_LS_KEY = 'codequest.voice';

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(VOICE_LS_KEY);
    if (raw) return { voiceURI: '', rate: 1.05, pitch: 1, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { voiceURI: '', rate: 1.05, pitch: 1 };
}

export function saveVoiceSettings(s: VoiceSettings): void {
  try { localStorage.setItem(VOICE_LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** System TTS voices. Browsers load these async — resolves once available. */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      const done = () => resolve(synth.getVoices());
      const existing = synth.getVoices();
      if (existing.length) { resolve(existing); return; }
      synth.onvoiceschanged = done;
      // Fallback: don't hang if the event never fires.
      setTimeout(() => resolve(synth.getVoices()), 1500);
    } catch { resolve([]); }
  });
}

/** Pick the best voice when the user hasn't chosen one: prefer high-quality
    English voices (Apple enhanced, Google natural), then any English, then default. */
export function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  const premium = pool.find((v) => /samantha|zira|david|mark|google us english|natural|enhanced|premium/i.test(v.name));
  if (premium) return premium;
  const local = pool.find((v) => v.localService);
  if (local) return local;
  const def = pool.find((v) => v.default);
  return def || pool[0];
}

/** Group voices by base language for the picker (e.g. "English (US)"). */
export function groupVoices(voices: SpeechSynthesisVoice[]): Array<{ label: string; voices: SpeechSynthesisVoice[] }> {
  const groups = new Map<string, SpeechSynthesisVoice[]>();
  for (const v of voices) {
    const base = (v.lang || 'unknown').split(/[-_]/)[0].toLowerCase();
    const label = languageName(base, v.lang);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(v);
  }
  return [...groups.entries()]
    .map(([label, vs]) => ({
      label,
      voices: vs.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      // English first, then alphabetical.
      if (/^english/i.test(a.label)) return -1;
      if (/^english/i.test(b.label)) return 1;
      return a.label.localeCompare(b.label);
    });
}

function languageName(base: string, full: string): string {
  const names: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
    pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
    hi: 'Hindi', ar: 'Arabic', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
    sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', ur: 'Urdu',
  };
  const region = full.split(/[-_]/)[1]?.toUpperCase();
  return (names[base] || base.toUpperCase()) + (region ? ` (${region})` : '');
}

export function speak(text: string, onEnd?: () => void): void {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const vs = loadVoiceSettings();
    u.rate = Math.min(2, Math.max(0.5, vs.rate || 1.05));
    u.pitch = Math.min(2, Math.max(0, vs.pitch ?? 1));
    const all = synth.getVoices();
    if (vs.voiceURI) {
      const v = all.find((x) => x.voiceURI === vs.voiceURI);
      if (v) u.voice = v;
    } else {
      // No explicit choice — use the best available voice, not the browser's arbitrary default.
      const best = pickBestVoice(all);
      if (best) u.voice = best;
    }
    if (onEnd) {
      let done = false;
      const finish = () => { if (!done) { done = true; onEnd(); } };
      u.onend = finish;
      u.onerror = finish;
      // Fallback: if speech never ends (no voices / blocked), advance anyway.
      const words = text.split(/\s+/).length;
      setTimeout(finish, Math.min(30000, Math.max(6000, (words / 2.4) * 1000)));
    }
    synth.speak(u);
  } catch { /* voice out unavailable — UI still shows text */ }
}

export function voiceSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!((window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition)
  );
}

export function startListening(
  onResult: (transcript: string) => void,
  onEnd: () => void,
  onError: (msg: string) => void
): () => void {
  const w = window as unknown as {
    webkitSpeechRecognition?: new () => VoiceRecognizer;
    SpeechRecognition?: new () => VoiceRecognizer;
  };
  const Ctor = w.webkitSpeechRecognition || w.SpeechRecognition;
  if (!Ctor) {
    onError('Voice input needs Chrome or Edge.');
    return () => {};
  }
  const rec: VoiceRecognizer = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
    const t = e.results[0]?.[0]?.transcript || '';
    if (t) onResult(t);
  };
  rec.onerror = (e: { error?: string }) => onError(`Mic error: ${e.error || 'unknown'}`);
  rec.onend = onEnd;
  try {
    rec.start();
  } catch {
    onError('Could not start the microphone.');
    onEnd();
  }
  return () => {
    try { rec.stop(); } catch { /* already stopped */ }
  };
}

interface VoiceRecognizer {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
