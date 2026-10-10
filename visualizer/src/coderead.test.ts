import { describe, it, expect } from 'vitest';
import { readCode, summarizeCode } from './lib/coderead';

describe('readCode', () => {
  it('extracts exported functions with JSDoc', () => {
    const src = `/** Formats a date for display. */
export function formatDate(d: Date): string {
  return d.toISOString();
}
/** Parses a URL string. */
export const parseUrl = (s: string) => new URL(s);
`;
    const sig = readCode(src, 'utils.ts');
    expect(sig.exports.map((e) => e.name)).toContain('formatDate');
    expect(sig.exports.map((e) => e.name)).toContain('parseUrl');
    expect(sig.exports.find((e) => e.name === 'formatDate')?.doc).toContain('Formats a date');
  });

  it('extracts classes and types', () => {
    const src = `export class UserService {}
export interface User { name: string; }
export type ID = string;
`;
    const sig = readCode(src, 'user.ts');
    expect(sig.exports.find((e) => e.name === 'UserService')?.kind).toBe('class');
    expect(sig.exports.find((e) => e.name === 'User')?.kind).toBe('type');
  });

  it('detects React components', () => {
    const src = `export function SettingsModal({ onClose }: Props) {
  return <div className="modal"><h1>Hi</h1></div>;
}
`;
    const sig = readCode(src, 'SettingsModal.tsx');
    expect(sig.isReactComponent).toBe(true);
  });

  it('detects API handlers with methods', () => {
    const src = `export async function GET(req: Request) { return Response.json({}); }
export async function POST(req: Request) { return Response.json({}); }
`;
    const sig = readCode(src, 'route.ts');
    expect(sig.isApiHandler).toBe(true);
    expect(sig.apiMethods).toEqual(['GET', 'POST']);
  });

  it('detects hooks', () => {
    const src = `/** Shared counter logic. */
export function useCounter() { return 0; }
`;
    const sig = readCode(src, 'useCounter.ts');
    expect(sig.isHook).toBe(true);
  });

  it('extracts file-level docblock', () => {
    const src = `/** Central store for user session state. */
export const store = {};
`;
    const sig = readCode(src, 'store.ts');
    expect(sig.topDoc).toContain('Central store');
  });

  it('handles empty/malformed input', () => {
    const sig = readCode('', 'empty.ts');
    expect(sig.exports).toEqual([]);
    expect(sig.lineCount).toBe(1);
  });
});

describe('summarizeCode', () => {
  it('prefers the file docblock', () => {
    const sig = readCode(`/** Payment processing core. */\nexport const x = 1;`, 'pay.ts');
    expect(summarizeCode(sig)).toContain('Payment processing core');
  });

  it('summarizes exports when no docs', () => {
    const sig = readCode(`export function a() {}\nexport function b() {}`, 'x.ts');
    const s = summarizeCode(sig);
    expect(s).toContain('`a`');
    expect(s).toContain('`b`');
  });

  it('returns null when nothing to say', () => {
    const sig = readCode(`const x = 1;`, 'x.ts');
    expect(summarizeCode(sig)).toBeNull();
  });
});
