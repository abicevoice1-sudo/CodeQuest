import { describe, it, expect } from 'vitest';
import { extractFileKey, fileUrlFor, embedUrlFor, matchFramesToFile } from './lib/figma';

describe('extractFileKey', () => {
  it('parses /file/ URLs', () => {
    expect(extractFileKey('https://www.figma.com/file/AbC123/My-App?node-id=1-2')).toBe('AbC123');
  });
  it('parses /design/ URLs', () => {
    expect(extractFileKey('https://www.figma.com/design/XyZ789/Admin')).toBe('XyZ789');
  });
  it('parses /board/ /slides/ /site/ URLs', () => {
    expect(extractFileKey('https://www.figma.com/board/qWe456/Roadmap')).toBe('qWe456');
    expect(extractFileKey('https://www.figma.com/slides/rTy789/Deck')).toBe('rTy789');
    expect(extractFileKey('https://www.figma.com/site/uIo012/Landing')).toBe('uIo012');
  });
  it('returns null for non-Figma URLs', () => {
    expect(extractFileKey('https://example.com/foo')).toBeNull();
    expect(extractFileKey('not a url')).toBeNull();
  });
});

describe('embedUrlFor', () => {
  it('builds a Figma embed URL', () => {
    const url = embedUrlFor('https://www.figma.com/design/AbC123/X', 'AbC123');
    expect(url).toContain('figma.com/embed');
    expect(url).toContain('embed_host=codequest');
  });
});

describe('fileUrlFor', () => {
  it('builds the canonical design URL', () => {
    expect(fileUrlFor('AbC123')).toBe('https://www.figma.com/design/AbC123/');
  });
});

describe('matchFramesToFile', () => {
  const doc = {
    document: {
      name: 'Document',
      type: 'DOCUMENT',
      children: [
        { name: 'Settings', type: 'FRAME', children: [] },
        { name: 'Settings modal', type: 'COMPONENT', children: [] },
        { name: 'Dashboard', type: 'FRAME', children: [] },
        { name: 'button', type: 'COMPONENT_SET', children: [] },
      ],
    },
  };

  it('matches frames to a component file name', () => {
    const hits = matchFramesToFile(doc, 'SettingsModal.tsx');
    expect(hits).toContain('Settings');
    expect(hits).toContain('Settings modal');
    expect(hits).not.toContain('Dashboard');
  });

  it('matches loosely by normalized prefix', () => {
    const hits = matchFramesToFile(doc, 'Settings.tsx');
    expect(hits).toContain('Settings');
  });

  it('returns empty for unrelated files', () => {
    expect(matchFramesToFile(doc, 'auth.ts')).toEqual([]);
  });

  it('handles malformed input gracefully', () => {
    expect(matchFramesToFile(null, 'x.tsx')).toEqual([]);
    expect(matchFramesToFile({}, 'x.tsx')).toEqual([]);
  });
});
