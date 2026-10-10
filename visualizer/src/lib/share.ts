/* Share links — encode the current view into the URL hash so anyone
   opening the link sees exactly what you see. Works in the static
   HTML export too, no server needed.
   Format: #s=<base64url of JSON {file, prof, guide, blast}> */

export interface SharedView {
  file?: string;   // selected module id
  prof?: string;   // proficiency
  guide?: boolean; // guide open
  blast?: string;  // blast-radius source module id
}

function b64urlEncode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)));
}

/** Encode a view into a hash string (without the leading #). */
export function encodeView(v: SharedView): string {
  const slim: SharedView = {};
  if (v.file) slim.file = v.file;
  if (v.prof) slim.prof = v.prof;
  if (v.guide) slim.guide = true;
  if (v.blast) slim.blast = v.blast;
  return 's=' + b64urlEncode(JSON.stringify(slim));
}

/** Decode a hash string into a view. Returns null if not a share link. */
export function decodeView(hash: string): SharedView | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h.startsWith('s=')) return null;
  try {
    const v = JSON.parse(b64urlDecode(h.slice(2))) as SharedView;
    if (typeof v !== 'object' || v === null) return null;
    return v;
  } catch {
    return null;
  }
}

/** Build the full share URL for the current page + view. */
export function buildShareUrl(v: SharedView, base?: string): string {
  const url = new URL(base || window.location.href);
  url.hash = encodeView(v);
  return url.toString();
}

/** Copy text to clipboard, with fallback for older browsers. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
