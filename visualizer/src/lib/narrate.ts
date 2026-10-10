/* Deterministic file narration — purpose + impact, no AI key needed.
   Everything is derived from the computed graph, so it always works.
   Tone adapts to the user's proficiency: non-technical readers get the
   business lens (what the business needs it for, what breaks for customers),
   developers get the technical lens at their level. */

import { blastRadius } from '../layout';
import { shortName, type CodeQuestGraph } from '../types';

export type Proficiency = 'non-technical' | 'beginner' | 'junior' | 'senior' | 'lead';

export const PROFICIENCY_LABELS: Record<Proficiency, string> = {
  'non-technical': 'Non-technical',
  beginner: 'Beginner',
  junior: 'Junior Developer',
  senior: 'Senior Developer',
  lead: 'Lead Developer',
};

export const PROFICIENCY_ORDER: Proficiency[] = [
  'non-technical',
  'beginner',
  'junior',
  'senior',
  'lead',
];

/** Migrate stored values from the old 3-level system. */
export function migrateProficiency(p: string | null): Proficiency {
  if (p === 'non-technical' || p === 'beginner' || p === 'junior' || p === 'senior' || p === 'lead')
    return p;
  if (p === 'developer') return 'junior';
  if (p === 'expert') return 'lead';
  return 'junior';
}

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

/* ------------------------------------------------------------------ */
/* Business lens — what the BUSINESS needs this file for               */
/* ------------------------------------------------------------------ */

interface BusinessRole {
  capability: string;
  why: string;
}

const BUSINESS_PATTERNS: [RegExp, string, string][] = [
  // Verb-first: what the file DOES (these read specifically even for dev tools).
  [/scan|inspect|audit/i,
    'examining the code and mapping how it all fits together',
    'it does the detective work — reading every file so the rest of the app can answer questions about the codebase'],
  [/export|report|publish|share/i,
    'producing the finished output customers receive',
    'it turns the app\u2019s work into something a person can open, read, and share'],
  [/command|cli|action/i,
    'the actions users can trigger',
    'every button-press or typed command flows through here — it is the app\u2019s control panel'],
  [/intel|analy|insight/i,
    'deeply understanding the codebase',
    'it figures out what the code means — not just what it says — so explanations stay accurate'],
  [/build|bundle|compile|package/i,
    'assembling the app for delivery',
    'it puts all the pieces together into the thing customers actually download or open'],
  [/visual|graph|render|draw|chart/i,
    'turning data into pictures people can read',
    'humans grasp a diagram in seconds that would take an hour in text — this file makes those pictures'],
  [/narrat|explain|descri|guide|tour/i,
    'explaining things in plain language',
    'it translates technical detail into words a non-expert can follow'],
  [/search|find|query|lookup/i,
    'finding things fast',
    'it helps people locate exactly what they need instead of scrolling forever'],
  [/auth|login|signin|sign-in|session|passport|oauth/i,
    'customer login and account security',
    'it proves customers are who they say they are — without it, anyone could open anyone\u2019s account'],
  [/pay|billing|checkout|stripe|invoice|subscri|refund/i,
    'taking money from customers',
    'this is how the business gets paid — every order flows through here'],
  [/order|cart|basket/i,
    'customer orders',
    'it tracks what customers buy, so nothing gets lost between click and delivery'],
  [/user|customer|account|profile|member/i,
    'customer accounts',
    'it remembers who your customers are — their details, history, and preferences'],
  [/product|catalog|inventory|stock|sku/i,
    'the product catalog',
    'it holds what the business sells — without it there is nothing to show customers'],
  [/email|mail|notif|sms|push|alert/i,
    'talking to customers',
    'it sends receipts, reminders, and updates — the business\u2019s voice to the customer'],
  [/report|analytic|dashboard|metric|insight/i,
    'business reports',
    'it tells the business what is working — sales, signups, problems — so decisions aren\u2019t guesses'],
  [/upload|file|storage|document|media|image/i,
    'customer files and documents',
    'it keeps the files the business and its customers rely on'],
  [/db|database|migrat|schema|repositor|seed/i,
    'where all business data lives',
    'every customer, order, and payment record sits behind this — it is the business\u2019s memory'],
  [/api|route|endpoint|controller|handler/i,
    'the counter where requests are served',
    'it is how the outside world asks the app for things — every tap in the app lands here'],
  [/config|setting|env|constant/i,
    'business settings',
    'it holds the dials the business runs on — prices, switches, keys, limits'],
  [/theme|style|css|layout/i,
    'how the app looks',
    'it controls the visual impression customers get — trust starts here'],
  [/test|spec|mock|fixture/i,
    'quality checks',
    'it catches mistakes before customers ever see them'],
  [/util|helper|common|shared|lib/i,
    'shared tools',
    'small helpers many parts of the app reuse, so the same job isn\u2019t built twice'],
];

function businessRole(name: string, layer: string, isEntry: boolean): BusinessRole {
  if (isEntry)
    return {
      capability: 'the front door — where the business opens each day',
      why: 'everything starts here; when the app wakes up, this file runs first and gets every other part ready',
    };
  for (const [re, capability, why] of BUSINESS_PATTERNS) {
    if (re.test(name)) return { capability, why };
  }
  const l = layer.toLowerCase();
  if (l.includes('ui') || l.includes('component'))
    return {
      capability: 'what customers see and touch',
      why: 'it is part of the screens customers interact with — confusing or broken screens lose customers',
    };
  if (l.includes('service'))
    return {
      capability: 'a business process',
      why: 'it carries out one of the jobs the business promises its customers',
    };
  if (l.includes('domain'))
    return {
      capability: 'a core business concept',
      why: 'it models something the business itself is built around',
    };
  if (l.includes('infra') || l.includes('data'))
    return {
      capability: 'plumbing the business runs on',
      why: 'customers never see it, but nothing works without it',
    };
  return {
    capability: 'part of how the app works',
    why: 'it plays its role behind the scenes to keep the app running',
  };
}

/** Business-lens description of a file, for non-technical readers. */
export function describeBusiness(id: string, graph: CodeQuestGraph): BusinessRole & { name: string } {
  const m = graph.modules.find((x) => x.id === id);
  const name = m ? shortName(m.path) : id;
  const role = businessRole(name, m?.layer || '', !!m?.isEntry);
  return { name, ...role };
}

function renderBusiness(f: Facts): Narration {
  const role = businessRole(f.name, f.layer, f.isEntry);
  const purpose =
    `${f.name} handles ${role.capability} — ${role.why}.` +
    (f.dependents.length
      ? ` ${f.dependents.length === 1 ? 'One other part of the app' : `${f.dependents.length} other parts of the app`} ` +
        `(${list(f.dependents)}) ${f.dependents.length === 1 ? 'relies' : 'rely'} on it to do ${f.dependents.length === 1 ? 'its' : 'their'} job${f.dependents.length === 1 ? '' : 's'}.`
      : ' Nothing else in the app depends on it directly.');
  let impact: string;
  if (f.blastCount === 0) {
    impact = `If ${f.name} breaks, customers likely won\u2019t notice — it stands alone, so the damage stops here.`;
  } else if (f.blastCount <= 2) {
    impact = `If ${f.name} breaks, customers using ${list(f.blastNames)} will feel it — worth fixing quickly, but the damage is contained.`;
  } else {
    impact =
      `If ${f.name} breaks, ${f.blastCount} parts of the app feel it — starting with ${list(f.blastNames, 3)}. ` +
      `For the business that can mean customers unable to ${/pay|billing|checkout/i.test(f.name) ? 'pay' : /auth|login/i.test(f.name) ? 'log in' : 'use the app'} until it\u2019s fixed. Treat changes here as high-stakes.`;
  }
  return { purpose, impact };
}

/* ------------------------------------------------------------------ */
/* Technical lens — beginner → lead                                    */
/* ------------------------------------------------------------------ */

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

function renderJunior(f: Facts): Narration {
  const p: string[] = [];
  p.push(
    f.isEntry
      ? `${f.name} is an entry point — the app starts executing here.`
      : `${f.name} is a ${f.layer} module${f.lines ? ` (${f.lines} lines)` : ''}.`
  );
  if (f.exports.length)
    p.push(`It exports ${list(f.exports, 5)} — these are the functions/values other files can use.`);
  if (f.dependents.length) {
    p.push(
      `${f.dependents.length === 1 ? 'One file imports' : `${f.dependents.length} files import`} it: ${list(f.dependents)}. ` +
      `A file with many importers is a shared dependency — changes need extra care.`
    );
  } else {
    p.push('Nothing else imports it, so it has no downstream consumers.');
  }
  if (f.deps.length) p.push(`It depends on ${list(f.deps)} — if those change, this file may need updates too.`);
  const impact =
    f.blastCount === 0
      ? `Changing ${f.name} is safe to experiment with: nothing else depends on it.`
      : `Blast radius: ${f.blastCount} file${f.blastCount === 1 ? '' : 's'} (${list(f.blastNames)}). ` +
        `Run the tests after changing it. Risk: ${f.risk}.`;
  return { purpose: p.join(' '), impact };
}

function renderSenior(f: Facts): Narration {
  const purpose =
    `${f.layer} · ${f.lines} lines${f.isEntry ? ' · entry' : ''}. ` +
    `Exposes ${f.exports.length ? list(f.exports, 6) : 'nothing'}. ` +
    `Fan-in ${f.dependents.length}${f.dependents.length ? ` (${list(f.dependents, 3)})` : ''} · ` +
    `fan-out ${f.deps.length}${f.deps.length ? ` (${list(f.deps, 4)})` : ''}.`;
  let impact: string;
  if (f.blastCount === 0) {
    impact = 'Isolated — no downstream. Safe to refactor freely.';
  } else {
    impact = `Blast radius ${f.blastCount} (${list(f.blastNames, 5)}). Risk ${f.risk}.`;
    if (f.dependents.length >= 4 && f.deps.length >= 4)
      impact += ' High coupling both ways — a change here deserves a design review.';
    else if (f.dependents.length >= 4)
      impact += ' Many consumers — keep its interface stable.';
  }
  return { purpose, impact };
}

function renderLead(f: Facts): Narration {
  const purpose =
    `${f.isEntry ? 'ENTRY' : f.layer.toUpperCase()} · ${f.lines} LOC. ` +
    `API: ${f.exports.length ? list(f.exports, 6) : '—'}. ` +
    `Consumers: ${f.dependents.length} · Deps: ${f.deps.length}.`;
  let impact: string;
  if (f.blastCount === 0) {
    impact = 'No downstream. Candidate for extraction or removal if unused.';
  } else {
    impact = `Downstream ${f.blastCount} (${list(f.blastNames, 4)}). Risk ${f.risk}.`;
    if (f.risk === 'CRITICAL' || f.risk === 'HIGH')
      impact += ' Architectural hotspot — consider an interface boundary or splitting before it grows further.';
    if (f.deps.length >= 6)
      impact += ' Wide fan-out suggests it knows too much; watch for a god-module forming.';
  }
  return { purpose, impact };
}

export function narrateFile(
  id: string,
  graph: CodeQuestGraph,
  proficiency: Proficiency = 'junior',
): Narration {
  const f = collectFacts(id, graph);
  if (!f) return { purpose: 'File not found in the graph.', impact: '' };
  switch (proficiency) {
    case 'non-technical':
      return renderBusiness(f);
    case 'beginner':
      return renderBeginner(f);
    case 'senior':
      return renderSenior(f);
    case 'lead':
      return renderLead(f);
    default:
      return renderJunior(f);
  }
}
