
import type { Proficiency } from './narrate';

/** What a database column is for — deterministic, from its name and type. */
export function describeColumn(
  colName: string,
  colType: string,
  tableName: string,
  prof: Proficiency = 'junior',
): string {
  const n = colName.toLowerCase();
  const t = (colType || '').toLowerCase();
  const tbl = tableName.toLowerCase();

  // Classify the column's role.
  let role: string;
  if (/^(id|uuid|guid)$/.test(n)) {
    role = 'pk';
  } else if (/_id$/.test(n)) {
    role = 'fk';
  } else if (/password|passwd|pwd|secret/.test(n)) {
    role = 'secret';
  } else if (/^e?mail/.test(n)) {
    role = 'email';
  } else if (/phone|mobile|tel/.test(n)) {
    role = 'phone';
  } else if (/^(created|inserted)(_at|at|on|date)?$/.test(n) || /created/.test(n)) {
    role = 'created';
  } else if (/^(updated|modified)(_at|at|on|date)?$/.test(n) || /updated/.test(n)) {
    role = 'updated';
  } else if (/deleted/.test(n)) {
    role = 'deleted';
  } else if (/^(name|title|label|display_name|full_name|username|slug)$/.test(n)) {
    role = 'name';
  } else if (/price|amount|total|cost|balance|fee|charge/.test(n)) {
    role = 'money';
  } else if (/status|state|stage/.test(n)) {
    role = 'status';
  } else if (/^(is_|has_|can_)|_flag$|active|enabled|verified|confirmed|archived/.test(n)) {
    role = 'flag';
  } else if (/avatar|image|photo|picture|logo|banner|thumbnail/.test(n)) {
    role = 'media';
  } else if (/address|street|city|zip|postal|country|lat|lng|lon|geo/.test(n)) {
    role = 'location';
  } else if (/token|api[_-]?key|session/.test(n)) {
    role = 'token';
  } else if (/count|quantity|qty|number|total/.test(n)) {
    role = 'count';
  } else if (/date|_at$|time/.test(n)) {
    role = 'time';
  } else if (/url|link|href|website/.test(n)) {
    role = 'url';
  } else if (/description|bio|notes?|comment|content|body|text|message/.test(n)) {
    role = 'text';
  } else {
    role = 'generic';
  }

  const refTable = role === 'fk' ? n.replace(/_id$/, '') : '';

  switch (prof) {
    case 'non-technical':
      return bizColumn(role, tbl, refTable);
    case 'beginner':
      return plainColumn(role, tbl, refTable, t);
    case 'senior':
    case 'lead':
      return terseColumn(role, refTable, t);
    default:
      return guidedColumn(role, tbl, refTable, t);
  }
}

function bizColumn(role: string, tbl: string, refTable: string): string {
  switch (role) {
    case 'pk': return `The unique label for each ${tbl} — like a serial number. Without it the business couldn't tell one ${tbl} from another.`;
    case 'fk': return `A link to a ${refTable} — it connects this ${tbl} to the ${refTable} it belongs to, so nothing gets orphaned.`;
    case 'secret': return `The scrambled password. The business needs it so customers can log in — but the real password is never stored here.`;
    case 'email': return `The customer's email — how the business reaches them and how they log in.`;
    case 'phone': return `The customer's phone number — for contact, verification codes, or delivery updates.`;
    case 'created': return `When this ${tbl} was created — the business needs it for history, reports, and "what happened when".`;
    case 'updated': return `When this ${tbl} was last changed — so the business always knows how fresh the information is.`;
    case 'deleted': return `A soft-delete marker — the business keeps the record but hides it, so nothing is ever truly lost by accident.`;
    case 'name': return `The human-readable name — what customers and staff actually see.`;
    case 'money': return `Money. The business needs it to charge, pay out, and report revenue — changes here affect real cash.`;
    case 'status': return `Where this ${tbl} stands right now (new, active, done…) — it drives what the business does next with it.`;
    case 'flag': return `A yes/no switch — the business flips it to turn a feature or state on and off.`;
    case 'media': return `A picture or file — what customers see instead of a blank box.`;
    case 'location': return `Where something is — the business needs it for delivery, maps, or regional rules.`;
    case 'token': return `A secret key for machines talking to machines — like a password the app uses behind the scenes.`;
    case 'count': return `A number the business tracks — stock, quantity, or usage.`;
    case 'time': return `A date or time the business needs — deadlines, schedules, and history all run on these.`;
    case 'url': return `A web address — where to find the related page or file.`;
    case 'text': return `The written content — descriptions, notes, or messages people actually read.`;
    default: return `A detail the app stores about each ${tbl} — part of what makes the record complete.`;
  }
}

function plainColumn(role: string, tbl: string, refTable: string, type: string): string {
  const typ = type ? ` (stored as ${type})` : '';
  switch (role) {
    case 'pk': return `The ID — every ${tbl} gets a unique one${typ}. It's how the app finds a specific ${tbl} later.`;
    case 'fk': return `Points at a row in ${refTable}${typ} — that's how this ${tbl} stays connected to its ${refTable}.`;
    case 'secret': return `The password, scrambled so it can't be read${typ}. The app checks your login against this scramble, never the real password.`;
    case 'email': return `An email address${typ} — used for login, contact, and notifications.`;
    case 'phone': return `A phone number${typ}.`;
    case 'created': return `Timestamp of when the row was created${typ} — useful for sorting and history.`;
    case 'updated': return `Timestamp of the last change${typ}.`;
    case 'deleted': return `Soft-delete flag${typ} — set instead of actually deleting the row.`;
    case 'name': return `The display name${typ} — what users see.`;
    case 'money': return `A money amount${typ} — handle with care, it affects billing.`;
    case 'status': return `The current state${typ} — like a label saying "new", "active", or "done".`;
    case 'flag': return `A true/false switch${typ}.`;
    case 'media': return `A file or image reference${typ}.`;
    case 'location': return `Location info${typ}.`;
    case 'token': return `A machine secret${typ} — keep it private.`;
    case 'count': return `A counter${typ}.`;
    case 'time': return `A date/time${typ}.`;
    case 'url': return `A web address${typ}.`;
    case 'text': return `Free text${typ}.`;
    default: return `A ${type || 'value'} the app stores on each ${tbl}.`;
  }
}

function guidedColumn(role: string, tbl: string, refTable: string, type: string): string {
  const typ = type ? ` \`${type}\`` : '';
  switch (role) {
    case 'pk': return `Primary key${typ} — the unique identifier for each \`${tbl}\` row. Indexed; used in joins and lookups.`;
    case 'fk': return `Foreign key → \`${refTable}\`${typ}. Enforces the relationship; deleting the parent may cascade or be blocked.`;
    case 'secret': return `Credential hash${typ} — salted/hashed at write time. Never store or log plaintext here.`;
    case 'created': return `Creation timestamp${typ}. Append-only audit signal; don't backfill casually.`;
    case 'updated': return `Last-modified timestamp${typ}. Check before assuming freshness.`;
    case 'deleted': return `Soft-delete marker${typ}. Queries should filter it unless you explicitly want archived rows.`;
    case 'money': return `Monetary amount${typ}. Prefer integer minor units; watch for float rounding.`;
    case 'status': return `State enum${typ}. Transitions may be guarded in application code — check before writing.`;
    case 'flag': return `Boolean flag${typ}.`;
    case 'token': return `Secret token${typ}. Treat like a credential — rotate, don't log.`;
    default: return `Column${typ} on \`${tbl}\`.`;
  }
}

function terseColumn(role: string, refTable: string, type: string): string {
  const typ = type ? ` ${type}` : '';
  switch (role) {
    case 'pk': return `PK${typ}.`;
    case 'fk': return `FK → ${refTable}${typ}.`;
    case 'secret': return `Credential hash${typ}. Never plaintext.`;
    case 'money': return `Money${typ}. Minor units preferred.`;
    case 'status': return `State${typ}. Check transition guards.`;
    case 'token': return `Secret${typ}. Don't log.`;
    default: return `${typ.trim() || 'Column'}.`;
  }
}
