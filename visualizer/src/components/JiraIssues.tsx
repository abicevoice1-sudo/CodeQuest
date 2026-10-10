import { useEffect, useState } from 'react';
import {
  extractTicketKeys, fetchJiraIssuesByKeys, jiraConfigured, loadJiraSettings,
  type JiraIssue,
} from '../lib/jira';

/** Shows Jira tickets linked to this file (matched by ticket key in path or code). */
export function JiraIssues({ filePath, code }: { filePath: string; code: string | null }) {
  const [issues, setIssues] = useState<JiraIssue[] | null>(null);
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    const js = loadJiraSettings();
    if (!jiraConfigured(js)) { setIssues(null); setKeys([]); return; }
    const found = extractTicketKeys(`${filePath}\n${code || ''}`);
    setKeys(found);
    if (!found.length) { setIssues([]); return; }
    let live = true;
    fetchJiraIssuesByKeys(js, found.slice(0, 10)).then((r) => { if (live) setIssues(r); });
    return () => { live = false; };
  }, [filePath, code]);

  if (issues === null) return null; // Jira not connected
  if (!keys.length) return null;    // no tickets referenced

  return (
    <div className="fd-section">
      <h4>🎫 Jira <span className="fd-count">{issues.length}</span></h4>
      {issues.length === 0 ? (
        <p className="modal-sub">Referenced {keys.join(', ')} — not found in Jira.</p>
      ) : (
        <div className="jira-list">
          {issues.map((i) => (
            <a key={i.key} href={i.url} target="_blank" rel="noreferrer" className="jira-card">
              <div className="jira-key">{i.key}</div>
              <div className="jira-summary">{i.summary}</div>
              <div className="jira-meta">
                <span className={`jira-status s-${i.status.toLowerCase().replace(/\s+/g, '-')}`}>{i.status}</span>
                {i.priority && <span className="jira-priority">{i.priority}</span>}
                <span className="jira-assignee">{i.assignee}</span>
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="modal-sub">Why this file exists — the story, priority, and who's waiting on it.</p>
    </div>
  );
}
