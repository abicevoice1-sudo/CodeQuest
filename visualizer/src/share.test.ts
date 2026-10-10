import { describe, it, expect } from 'vitest';
import { encodeView, decodeView, buildShareUrl, isLocalOnlyUrl } from './lib/share';

describe('encodeView/decodeView', () => {
  it('round-trips a full view', () => {
    const v = { file: 'src/App.tsx', prof: 'non-technical', guide: true, blast: 'src/auth.ts' };
    const decoded = decodeView('#' + encodeView(v));
    expect(decoded).toEqual(v);
  });

  it('round-trips a minimal view', () => {
    const decoded = decodeView(encodeView({ prof: 'senior' }));
    expect(decoded).toEqual({ prof: 'senior' });
  });

  it('returns null for non-share hashes', () => {
    expect(decodeView('')).toBeNull();
    expect(decodeView('#foo')).toBeNull();
    expect(decodeView('#s=!!!invalid!!!')).toBeNull();
  });

  it('handles unicode file paths', () => {
    const v = { file: 'src/café.tsx' };
    expect(decodeView('#' + encodeView(v))).toEqual(v);
  });
});

describe('buildShareUrl', () => {
  it('preserves the page URL and sets the hash', () => {
    const url = buildShareUrl({ file: 'a.ts' }, 'https://example.com/report.html');
    expect(url).toContain('#s=');
    expect(url.startsWith('https://example.com/report.html')).toBe(true);
    expect(decodeView(new URL(url).hash)).toEqual({ file: 'a.ts' });
  });
});

describe('isLocalOnlyUrl', () => {
  it('flags localhost variants', () => {
    expect(isLocalOnlyUrl('http://localhost:1337/#s=abc')).toBe(true);
    expect(isLocalOnlyUrl('http://127.0.0.1:1337/#s=abc')).toBe(true);
    expect(isLocalOnlyUrl('http://0.0.0.0:1337/#s=abc')).toBe(true);
    expect(isLocalOnlyUrl('http://my-mac.local:1337/#s=abc')).toBe(true);
  });
  it('flags local files', () => {
    expect(isLocalOnlyUrl('file:///Users/syed/report.html#s=abc')).toBe(true);
  });
  it('passes real hosted URLs', () => {
    expect(isLocalOnlyUrl('https://acme.com/report.html#s=abc')).toBe(false);
    expect(isLocalOnlyUrl('https://syed.github.io/codequest/report.html#s=abc')).toBe(false);
  });
});
