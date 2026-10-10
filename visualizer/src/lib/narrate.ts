/* Deterministic file narration — purpose + impact, no AI key needed.
   Everything is derived from the computed graph, so it always works. */

import { blastRadius } from '../layout';
import { shortName, type CodeQuestGraph } from '../types';

export interface Narration {
  purpose: string;
  impact: string;
}

function list(names: string[], max = 4): string {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown}, and ${names.length - max} more` : shown;
}

export function narrateFile(id: string, graph: CodeQuestGraph): Narration {
  const m = graph.modules.find((x) => x.id === id);
  if (!m) return { purpose: 'File not found in the graph.', impact: '' };
  const name = shortName(m.path);
  const says: string[] = [];

  const article = /^[aeiou]/i.test(m.layer) ? 'an' : 'a';
  says.push(`${name} is ${article} ${m.layer} module${m.lines ? `, ${m.lines} lines` : ''}.`);
  if (m.isEntry) says.push('It is an entry point — execution starts here.');
  if (m.exports && m.exports.length) says.push(`It exposes ${list(m.exports, 5)}.`);

  const dependents = graph.edges.filter((e) => e.to === id).map((e) => shortName(e.to === id ? e.from : e.to));
  const deps = graph.edges.filter((e) => e.from === id).map((e) => shortName(e.to));
  if (dependents.length) {
    says.push(
      `${dependents.length === 1 ? 'One file imports' : `${dependents.length} files import`} it: ${list(dependents)}.`
    );
  } else {
    says.push('Nothing else imports it.');
  }
  if (deps.length) says.push(`It depends on ${list(deps)}.`);

  const blast = blastRadius(graph, id);
  const affected = [...blast.entries()]
    .filter(([k]) => k !== id)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  let impact: string;
  if (affected.length === 0) {
    impact = `Changing ${name} affects nothing else — it is isolated.`;
  } else {
    const n = affected.length;
    impact =
      `Changing ${name} would ripple through ${n} file${n === 1 ? '' : 's'}` +
      `, starting with ${list(affected.map(([k]) => shortName(k)))}. ` +
      `Risk rating: ${m.risk || 'LOW'}.`;
  }
  return { purpose: says.join(' '), impact };
}
