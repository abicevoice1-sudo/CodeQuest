/* Jira integration — bridge code to business context.
   Lets business people see WHY code exists (the ticket, the story, the priority)
   and lets devs see the business side of what they're changing.
   Uses Jira Cloud REST API with an API token. Credentials stay in the browser. */

export interface JiraSettings {
  url: string;      // e.g. https://yourcompany.atlassian.net
  email: string;
  apiToken: string;
  projectKey: string; // e.g. PROJ — limits searches to this project
}

const LS_KEY = 'codequest.jira';

export function loadJiraSettings(): JiraSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { url: '', email: '', apiToken: '', projectKey: '', ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { url: '', email: '', apiToken: '', projectKey: '' };
}

export function saveJiraSettings(s: JiraSettings): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function jiraConfigured(s: JiraSettings): boolean {
  return !!(s.url && s.email && s.apiToken);
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  priority: string;
  issueType: string;
  assignee: string;
  url: string;
}

function authHeader(s: JiraSettings): string {
  return 'Basic ' + btoa(`${s.email}:${s.apiToken}`);
}

function base(s: JiraSettings): string {
  return s.url.trim().replace(/\/$/, '');
}

/** Test the connection — returns the logged-in user's name or throws. */
export async function testJiraConnection(s: JiraSettings): Promise<string> {
  const r = await fetch(`${base(s)}/rest/api/3/myself`, {
    headers: { Authorization: authHeader(s), Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(r.status === 401 ? 'Invalid email or API token.' : `Jira returned ${r.status}.`);
  const j = await r.json();
  return j.displayName || j.emailAddress || 'Connected';
}

/** Fetch recent issues for the project (or all if no project key). */
export async function fetchJiraIssues(s: JiraSettings, max = 25): Promise<JiraIssue[]> {
  const jql = s.projectKey
    ? `project = ${s.projectKey} ORDER BY updated DESC`
    : `ORDER BY updated DESC`;
  const r = await fetch(
    `${base(s)}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${max}&fields=summary,status,priority,issuetype,assignee`,
    { headers: { Authorization: authHeader(s), Accept: 'application/json' } }
  );
  if (!r.ok) throw new Error(`Jira search failed (${r.status}).`);
  const j = await r.json();
  return (j.issues || []).map((i: Record<string, unknown>) => {
    const f = (i.fields || {}) as Record<string, { name?: string; displayName?: string } | undefined>;
    return {
      key: i.key as string,
      summary: (f.summary as unknown as string) || '',
      status: f.status?.name || '',
      priority: f.priority?.name || '',
      issueType: f.issuetype?.name || '',
      assignee: f.assignee?.displayName || 'Unassigned',
      url: `${base(s)}/browse/${i.key}`,
    };
  });
}

/** Extract Jira ticket keys (e.g. PROJ-123) from any text. */
export function extractTicketKeys(text: string): string[] {
  const found = new Set<string>();
  const re = /\b([A-Z][A-Z0-9_]+-\d+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) found.add(m[1]);
  return [...found];
}

/** Fetch full details for specific issue keys. */
export async function fetchJiraIssuesByKeys(s: JiraSettings, keys: string[]): Promise<JiraIssue[]> {
  if (!keys.length) return [];
  const jql = `key in (${keys.join(',')})`;
  const r = await fetch(
    `${base(s)}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,priority,issuetype,assignee`,
    { headers: { Authorization: authHeader(s), Accept: 'application/json' } }
  );
  if (!r.ok) return [];
  const j = await r.json();
  return (j.issues || []).map((i: Record<string, unknown>) => {
    const f = (i.fields || {}) as Record<string, { name?: string; displayName?: string } | undefined>;
    return {
      key: i.key as string,
      summary: (f.summary as unknown as string) || '',
      status: f.status?.name || '',
      priority: f.priority?.name || '',
      issueType: f.issuetype?.name || '',
      assignee: f.assignee?.displayName || 'Unassigned',
      url: `${base(s)}/browse/${i.key}`,
    };
  });
}
