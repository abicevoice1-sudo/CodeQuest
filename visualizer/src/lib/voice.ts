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

export function speak(text: string): void {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
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
