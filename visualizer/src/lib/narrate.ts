/* Deterministic file narration — purpose + impact, no AI key needed.
   Everything is derived from the computed graph, so it always works.
   Tone adapts to the user's technical proficiency. */

import { blastRadius } from '../layout';
import { shortName, type CodeQuestGraph } from '../types';

export type Proficiency = 'beginner' | 'developer' | 'expert';

export interface Narration {
  purpose: string;
  impact: string;
}

interface Facts {
  name: string;
  layer: string;
  lines: number;
  isEntry: boolean;
  exports: string[];
  dependents: string[];
  deps: string[];
  blastCount: number;
  blastNames: string[];
  risk: string;
}

function list(names: string[], max = 4): string {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown}, and ${names.length - max} more` : shown;
}

function collectFacts(id: string, graph: CodeQuestGraph): Facts | null {
  const m = graph.modules.find((x) => x.id === id);
  if (!m) return null;
  const dependents = graph.edges.filter((e) => e.to === id).map((e) => shortName(e.from));
  const deps = graph.edges.filter((e) => e.from === id).map((e) => shortName(e.to));
  const blast = blastRadius(graph, id);
  const affected = [...blast.entries()]
    .filter(([k]) => k !== id)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return {
    name: shortName(m.path),
    layer: m.layer,
    lines: m.lines || 0,
    isEntry: !!m.isEntry,
    exports: m.exports || [],
    dependents,
    deps,
    blastCount: affected.length,
    blastNames: affected.map(([k]) => shortName(k)),
    risk: m.risk || 'LOW',
  };
}

function renderBeginner(f: Facts): Narration {
  const p: string[] = [];
  p.push(
    f.isEntry
      ? `${f.name} is where this app starts running.`
      : `${f.name} is one of the files that makes this app work.`
  );
  if (f.exports.length) p.push(`It provides these building blocks: ${list(f.exports, 5)}.`);
  if (f.dependents.length) {
    p.push(
      `${f.dependents.length === 1 ? 'One other file uses' : `${f.dependents.length} other files use`} it: ${list(f.dependents)}.`
    );
  } else {
    p.push('No other file uses it directly.');
  }
  if (f.deps.length) p.push(`It relies on: ${list(f.deps)}.`);
  const impact =
    f.blastCount === 0
      ? `Changing ${f.name} won't break anything else — it stands alone.`
      : `Be careful changing ${f.name}: ${f.blastCount} other file${f.blastCount === 1 ? '' : 's'} could break, ` +
        `starting with ${list(f.blastNames)}.`;
  return { purpose: p.join(' '), impact };
}

function renderDeveloper(f: Facts): Narration {
  const says: string[] = [];
  const article = /^[aeiou]/i.test(f.layer) ? 'an' : 'a';
  says.push(`${f.name} is ${article} ${f.layer} module${f.lines ? `, ${f.lines} lines` : ''}.`);
  if (f.isEntry) says.push('It is an entry point — execution starts here.');
  if (f.exports.length) says.push(`It exposes ${list(f.exports, 5)}.`);
  if (f.dependents.length) {
    says.push(
      `${f.dependents.length === 1 ? 'One file imports' : `${f.dependents.length} files import`} it: ${list(f.dependents)}.`
    );
  } else {
    says.push('Nothing else imports it.');
  }
  if (f.deps.length) says.push(`It depends on ${list(f.deps)}.`);
  const impact =
    f.blastCount === 0
      ? `Changing ${f.name} affects nothing else — it is isolated.`
      : `Changing ${f.name} would ripple through ${f.blastCount} file${f.blastCount === 1 ? '' : 's'}` +
        `, starting with ${list(f.blastNames)}. ` +
        `Risk rating: ${f.risk}.`;
  return { purpose: says.join(' '), impact };
}

function renderExpert(f: Facts): Narration {
  const purpose =
    `${f.isEntry ? 'Entry' : f.layer} · ${f.lines} lines. ` +
    `Exports: ${f.exports.length ? list(f.exports, 6) : '—'}. ` +
    `Imported by ${f.dependents.length}${f.dependents.length ? ` (${list(f.dependents, 3)})` : ''}. ` +
    `Depends on ${f.deps.length ? list(f.deps, 4) : '—'}.`;
  const impact =
    f.blastCount === 0
      ? 'Isolated. No downstream.'
      : `Blast radius ${f.blastCount}: ${list(f.blastNames, 5)}. Risk ${f.risk}.`;
  return { purpose, impact };
}

export function narrateFile(
  id: string,
  graph: CodeQuestGraph,
  proficiency: Proficiency = 'developer',
): Narration {
  const f = collectFacts(id, graph);
  if (!f) return { purpose: 'File not found in the graph.', impact: '' };
  if (proficiency === 'beginner') return renderBeginner(f);
  if (proficiency === 'expert') return renderExpert(f);
  return renderDeveloper(f);
}
