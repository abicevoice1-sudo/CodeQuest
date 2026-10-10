export type ThemeId = 'dark' | 'light' | 'vscode-dark' | 'monokai' | 'dracula';

export const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'dark', label: 'Dark', hint: 'CodeQuest default' },
  { id: 'light', label: 'Light', hint: 'Bright and clean' },
  { id: 'vscode-dark', label: 'VS Code Dark+', hint: 'The editor you know' },
  { id: 'monokai', label: 'Monokai', hint: 'Warm classic' },
  { id: 'dracula', label: 'Dracula', hint: 'Purple dusk' },
];

const KEY = 'codequest.theme';

export function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY) as ThemeId | null;
    if (v && THEMES.some((t) => t.id === v)) return v;
  } catch { /* ignore */ }
  return 'dark';
}

export function saveTheme(t: ThemeId) {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
}

export function applyTheme(t: ThemeId) {
  document.documentElement.setAttribute('data-theme', t);
}
