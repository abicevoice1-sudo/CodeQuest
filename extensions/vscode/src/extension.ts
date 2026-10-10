import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';

const PACK_ANALYZER = 'aperio/bin/aperio';

/** Find the Aperio pack: bundled with the extension, or a sibling checkout. */
function findPackRoot(extRoot: string): string | null {
  const bundled = path.join(extRoot, PACK_ANALYZER);
  if (fs.existsSync(bundled)) return path.join(extRoot, 'aperio');
  // Dev: extension lives at <repo>/extensions/vscode → pack at <repo>/aperio
  const dev = path.join(extRoot, '..', '..', 'aperio', 'bin', 'aperio');
  if (fs.existsSync(dev)) return path.join(extRoot, '..', '..', 'aperio');
  return null;
}

function runScan(packRoot: string, workspaceRoot: string, engine: string): string {
  const bin = path.join(packRoot, 'bin', 'aperio');
  const args = ['scan', workspaceRoot];
  if (engine === 'tree-sitter') args.push('--engine', 'tree-sitter');
  execFileSync(process.execPath, [bin, ...args], { stdio: 'pipe', timeout: 120000 });
  return path.join(workspaceRoot, '.aperio., 'graph.json');
}

class AperioViewProvider implements vscode.WebviewViewProvider {
  constructor(private extRoot: string) {}

  resolveWebviewView(view: vscode.WebviewView) {
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.file(this.extRoot)] };
    view.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.command === 'openFile' && msg.path && vscode.workspace.workspaceFolders?.length) {
        const uri = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, msg.path));
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: true });
        } catch {
          vscode.window.showWarningMessage(`Aperio: cannot open ${msg.path}`);
        }
      }
    });
    this.refresh(view);
  }

  refresh(view: vscode.WebviewView) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      view.webview.html = `<body style="background:#0a0a0c;color:#a1a1aa;font-family:sans-serif;padding:24px">Open a folder to use Aperio.</body>`;
      return;
    }
    const ws = folders[0].uri.fsPath;
    const packRoot = findPackRoot(this.extRoot);
    if (!packRoot) {
      view.webview.html = `<body style="background:#0a0a0c;color:#a1a1aa;font-family:sans-serif;padding:24px">Aperio analyzer not found.</body>`;
      return;
    }
    try {
      const engine = vscode.workspace.getConfiguration('aperio').get<string>('engine', 'regex');
      const graphPath = runScan(packRoot, ws, engine);
      const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      view.webview.html = this.htmlFor(view.webview, graph);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      view.webview.html = `<body style="background:#0a0a0c;color:#fda4af;font-family:sans-serif;padding:24px">Aperio scan failed:<br><pre>${msg.replace(/</g, '&lt;')}</pre></body>`;
    }
  }

  private htmlFor(webview: vscode.Webview, graph: unknown): string {
    const media = path.join(this.extRoot, 'media');
    let html = fs.readFileSync(path.join(media, 'index.html'), 'utf8');
    // Rewrite absolute asset URLs to webview URIs.
    html = html.replace(/(src|href)="\/assets\//g, (_m, attr) => {
      const uri = webview.asWebviewUri(vscode.Uri.file(path.join(media, 'assets')));
      return `${attr}="${uri}/`;
    });
    // VS Code webviews need relative base fixes for fetch('./...').
    const safe = JSON.stringify(graph).replace(/</g, '\\u003c');
    html = html.replace(
      '</head>',
      `<base href="${webview.asWebviewUri(vscode.Uri.file(media))}/">\n<script>window.__CODEQUEST_GRAPH__=${safe};</script>\n</head>`,
    );
    const csp = `default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};`;
    html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    return html;
  }
}

export function activate(ctx: vscode.ExtensionContext) {
  const provider = new AperioViewProvider(ctx.extensionPath);
  ctx.subscriptions.push(vscode.window.registerWebviewViewProvider(.aperio.view', provider));

  ctx.subscriptions.push(
    vscode.commands.registerCommand('aperio.scan', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) return vscode.window.showWarningMessage('Aperio: open a folder first.');
      const packRoot = findPackRoot(ctx.extensionPath);
      if (!packRoot) return vscode.window.showErrorMessage('Aperio: analyzer not found.');
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Aperio: scanning…' },
        async () => {
          try {
            const engine = vscode.workspace.getConfiguration('aperio').get<string>('engine', 'regex');
            runScan(packRoot, folders[0].uri.fsPath, engine);
            vscode.window.showInformationMessage('Aperio: scan complete.');
          } catch (e) {
            vscode.window.showErrorMessage(`Aperio scan failed: ${e instanceof Error ? e.message : e}`);
          }
        },
      );
    }),
    vscode.commands.registerCommand('aperio.openGraph', () =>
      vscode.commands.executeCommand(.aperio.view.focus'),
    ),
  );
}

export function deactivate() {}
