/* AI file explanations — bring your own key, OpenAI-compatible endpoint.
   Key lives in localStorage; it only ever goes to the endpoint you configure. */

export interface AISettings {
  endpoint: string; // base URL, e.g. https://api.openai.com/v1
  apiKey: string;
  model: string;
}

const LS_KEY = 'codequest.ai';

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini', ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { endpoint: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' };
}

export function saveAISettings(s: AISettings): void {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export interface ExplainContext {
  path: string;
  layer?: string;
  risk?: string;
  lines?: number;
  imports: string[];
  importedBy: string[];
  exports: string[];
  code: string;
}

export async function explainFile(ctx: ExplainContext, s: AISettings): Promise<string> {
  if (!s.apiKey) throw new Error('Add your API key in Settings (gear icon) first.');
  const endpoint = s.endpoint.replace(/\/$/, '');
  const code = ctx.code.length > 14000 ? ctx.code.slice(0, 14000) + '\n…(truncated)' : ctx.code;
  const user = [
    `File: ${ctx.path}  (layer: ${ctx.layer || '?'}, risk: ${ctx.risk || '?'}, ${ctx.lines ?? '?'} lines)`,
    ctx.exports.length ? `Exports: ${ctx.exports.slice(0, 20).join(', ')}` : '',
    ctx.imports.length ? `Imports: ${ctx.imports.slice(0, 20).join(', ')}` : '',
    ctx.importedBy.length ? `Imported by: ${ctx.importedBy.slice(0, 20).join(', ')}` : '',
    '',
    '```',
    code,
    '```',
  ].filter(Boolean).join('\n');

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
    body: JSON.stringify({
      model: s.model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior staff engineer explaining a single file to a developer who just opened it. ' +
            'Be concrete and specific to THIS file. Format: one short "What it does" paragraph, then 3-6 bullet points ' +
            'covering the key functions/logic and gotchas. Keep it under 220 words. No fluff, no generic advice.',
        },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${t.slice(0, 160) || res.statusText}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from the model.');
  return text;
}

/** Minimal markdown → HTML for explanation output (bold, bullets, code). */
export function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const fmt = (s: string) =>
      esc(s)
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${fmt(bullet[1])}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (h) html += `<h${h[1].length}>${fmt(h[2])}</h${h[1].length}>`;
      else if (line.trim() === '') html += '';
      else html += `<p>${fmt(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}
