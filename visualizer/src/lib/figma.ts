/* Figma integration — bridge designs to code.
   Lets business people and designers attach Figma files so anyone viewing
   the codebase can see what the design looks like, not just the code.
   Uses a Figma personal access token. Credentials stay in the browser. */

export interface FigmaSettings {
  accessToken: string;
  fileUrls: string[]; // Figma file/branch URLs, one per line in settings
}

const LS_KEY = 'codequest.figma';

export function loadFigmaSettings(): FigmaSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return {
        accessToken: j.accessToken || '',
        fileUrls: Array.isArray(j.fileUrls) ? j.fileUrls : [],
      };
    }
  } catch { /* ignore */ }
  return { accessToken: '', fileUrls: [] };
}

export function saveFigmaSettings(s: FigmaSettings): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function figmaConfigured(s: FigmaSettings): boolean {
  return !!s.accessToken;
}

/** Extract the file key from a Figma URL.
    Handles /file/KEY/Title, /design/KEY/Title, /board/KEY, /slides/KEY, /site/KEY */
export function extractFileKey(url: string): string | null {
  const m = /figma\.com\/(?:file|design|board|slides|site|proto)\/([A-Za-z0-9]+)/.exec(url.trim());
  return m ? m[1] : null;
}

/** The public Figma file URL for a key (stable canonical form). */
export function fileUrlFor(key: string): string {
  return `https://www.figma.com/design/${key}/`;
}

/** Embed URL for the live Figma iframe preview. */
export function embedUrlFor(fileUrl: string, key: string): string {
  const target = extractFileKey(fileUrl) ? fileUrl : fileUrlFor(key);
  return `https://www.figma.com/embed?embed_host=codequest&url=${encodeURIComponent(target)}`;
}

export interface FigmaFile {
  key: string;
  name: string;
  thumbnailUrl: string;
  lastModified: string;
  url: string;
}

function headers(s: FigmaSettings): HeadersInit {
  return { 'X-Figma-Token': s.accessToken };
}

/** Test the connection — returns the logged-in user's name or throws. */
export async function testFigmaConnection(s: FigmaSettings): Promise<string> {
  const r = await fetch('https://api.figma.com/v1/me', { headers: headers(s) });
  if (!r.ok) throw new Error(r.status === 403 ? 'Invalid access token.' : `Figma returned ${r.status}.`);
  const j = await r.json();
  return j.handle || j.email || 'Connected';
}

/** Fetch metadata for one file key. */
export async function fetchFigmaFile(s: FigmaSettings, key: string): Promise<FigmaFile> {
  const r = await fetch(`https://api.figma.com/v1/files/${key}`, { headers: headers(s) });
  if (!r.ok) throw new Error(`Figma file fetch failed (${r.status}).`);
  const j = await r.json();
  return {
    key,
    name: j.name || key,
    thumbnailUrl: j.thumbnailUrl || '',
    lastModified: j.lastModified || '',
    url: fileUrlFor(key),
  };
}

/** Fetch metadata for every linked file. Failures resolve to null and are skipped. */
export async function fetchLinkedFiles(s: FigmaSettings): Promise<FigmaFile[]> {
  const keys = s.fileUrls.map(extractFileKey).filter((k): k is string => !!k);
  const unique = [...new Set(keys)];
  const out: FigmaFile[] = [];
  for (const key of unique) {
    try {
      out.push(await fetchFigmaFile(s, key));
    } catch { /* skip unreachable files */ }
  }
  return out;
}

/** Flatten the document tree to find frames/components matching a file name.
    Matches e.g. SettingsModal.tsx → frames named "Settings", "SettingsModal", "Settings modal". */
export function matchFramesToFile(doc: unknown, fileName: string): string[] {
  const base = fileName
    .replace(/\.(tsx?|jsx?|vue|svelte|css|scss)$/i, '')
    .replace(/(Modal|Dialog|Panel|View|Page|Screen|Card|List|Item)$/i, '');
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(base);
  if (!target) return [];
  const hits: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { name?: string; type?: string; children?: unknown[] };
    if (
      typeof n.name === 'string' &&
      (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'COMPONENT_SET' || n.type === 'INSTANCE')
    ) {
      const nn = norm(n.name);
      if (nn === target || nn.startsWith(target) || target.startsWith(nn)) {
        if (!hits.includes(n.name)) hits.push(n.name);
      }
    }
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  walk((doc as { document?: unknown })?.document ?? doc);
  return hits.slice(0, 8);
}
