import { describe, it, expect } from 'vitest';
import { parseVoiceCommand, resolveTarget } from './lib/voice';
import { highlightLine, langOf } from './lib/highlight';
import { mdToHtml } from './lib/ai';

describe('parseVoiceCommand', () => {
  it('parses find', () => {
    expect(parseVoiceCommand('find login')).toEqual({ kind: 'find', query: 'login' });
    expect(parseVoiceCommand('search for the auth file')).toEqual({ kind: 'find', query: 'auth' });
  });
  it('parses explain (named and self)', () => {
    expect(parseVoiceCommand('explain this file')).toEqual({ kind: 'explain', target: null });
    expect(parseVoiceCommand('explain api urls')).toEqual({ kind: 'explain', target: 'api urls' });
  });
  it('parses blast radius', () => {
    expect(parseVoiceCommand('blast radius of auth')).toEqual({ kind: 'blast', target: 'auth' });
    expect(parseVoiceCommand('blast radius').kind).toBe('unknown'); // needs a target
  });
  it('parses clear + unknown', () => {
    expect(parseVoiceCommand('clear')).toEqual({ kind: 'clear' });
    expect(parseVoiceCommand('hello there').kind).toBe('unknown');
  });
});

describe('resolveTarget', () => {
  const ids = ['api/urls.py', 'api/views.py', 'web/app/page.tsx'];
  it('matches by filename', () => {
    expect(resolveTarget('urls', ids)).toBe('api/urls.py');
    expect(resolveTarget('page', ids)).toBe('web/app/page.tsx');
  });
  it('returns null when nothing matches', () => {
    expect(resolveTarget('zzz-nope', ids)).toBeNull();
  });
});

describe('highlightLine', () => {
  it('highlights keywords, strings, comments', () => {
    const h = highlightLine('const x = "hi"; // done', 'c');
    expect(h).toContain('tk-kw');
    expect(h).toContain('tk-str');
    expect(h).toContain('tk-com');
  });
  it('escapes HTML', () => {
    expect(highlightLine('<div>', 'c')).toContain('&lt;div&gt;');
  });
  it('detects language', () => {
    expect(langOf('a.py')).toBe('py');
    expect(langOf('a.tsx')).toBe('c');
    expect(langOf('a.md')).toBe('plain');
  });
});

describe('mdToHtml', () => {
  it('renders bullets and bold', () => {
    const h = mdToHtml('- **hi** there');
    expect(h).toContain('<ul>');
    expect(h).toContain('<b>hi</b>');
  });
});

describe('fuzzySearch', () => {
  const ids = ['api/urls.py', 'api/views.py', 'web/app/page.tsx', 'codequest/lib/serve.js'];
  it('ranks exact filename matches first', async () => {
    const { fuzzySearch } = await import('./lib/search');
    const hits = fuzzySearch('urls', ids);
    expect(hits[0].id).toBe('api/urls.py');
  });
  it('matches subsequences', async () => {
    const { fuzzySearch } = await import('./lib/search');
    const hits = fuzzySearch('srv', ids);
    expect(hits.some((h) => h.id === 'codequest/lib/serve.js')).toBe(true);
  });
  it('returns empty for no match', async () => {
    const { fuzzySearch } = await import('./lib/search');
    expect(fuzzySearch('zzz-nope', ids)).toEqual([]);
  });
});

describe('narrateFile', () => {
  it('describes purpose and impact from the graph', async () => {
    const { narrateFile } = await import('./lib/narrate');
    const graph = {
      modules: [
        { id: 'a.js', path: 'a.js', layer: 'app', risk: 'HIGH', lines: 42, isEntry: true, exports: ['start'], fanIn: 2, fanOut: 1 },
        { id: 'b.js', path: 'b.js', layer: 'lib', risk: 'LOW', lines: 10, exports: [], fanIn: 0, fanOut: 0 },
        { id: 'c.js', path: 'c.js', layer: 'lib', risk: 'LOW', lines: 10, exports: [], fanIn: 0, fanOut: 0 },
      ],
      edges: [
        { from: 'b.js', to: 'a.js' },
        { from: 'c.js', to: 'a.js' },
        { from: 'a.js', to: 'b.js' },
      ],
    } as never;
    const n = narrateFile('a.js', graph);
    expect(n.purpose).toContain('a.js is a app module');
    expect(n.purpose).toContain('entry point');
    expect(n.purpose).toContain('2 files import it');
    expect(n.impact).toContain('ripple through');
    expect(n.impact).toContain('HIGH');
    const iso = narrateFile('c.js', graph);
    expect(iso.impact).toContain('ripple through');
  });
});
