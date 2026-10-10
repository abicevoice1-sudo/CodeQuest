/* Fuzzy file search — subsequence matching with word-boundary bonuses. */

export interface ScoredHit {
  id: string;
  score: number;
}

/** Score how well `query` matches `target`. Higher is better; -1 = no match. */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return -1;
  if (t === q) return 1000;
  const base = t.split('/').pop() || t;
  if (base === q) return 900;
  if (base.startsWith(q)) return 700;
  if (t.includes(q)) return 500 + (base.includes(q) ? 100 : 0);

  // subsequence match: all query chars appear in order
  let ti = 0;
  let score = 0;
  let lastMatch = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    let found = -1;
    for (let j = ti; j < t.length; j++) {
      if (t[j] === c) { found = j; break; }
    }
    if (found === -1) return -1;
    // bonus for word boundaries and consecutive matches
    if (found === 0 || '/_-.'.includes(t[found - 1])) score += 12;
    if (found === lastMatch + 1) score += 8;
    if (base.includes(t.slice(Math.max(0, found - 3), found + 1))) score += 2;
    score += 5;
    lastMatch = found;
    ti = found + 1;
  }
  // prefer shorter targets (less noise)
  return score - t.length * 0.2;
}

export function fuzzySearch(query: string, ids: string[], limit = 8): ScoredHit[] {
  const out: ScoredHit[] = [];
  for (const id of ids) {
    const score = fuzzyScore(query, id);
    if (score > 0) out.push({ id, score });
  }
  out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return out.slice(0, limit);
}
