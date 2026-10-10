"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const PACK_ANALYZER = 'codequest/bin/codequest';
/** Find the CodeQuest pack: bundled with the extension, or a sibling checkout. */
function findPackRoot(extRoot) {
    const bundled = path.join(extRoot, PACK_ANALYZER);
    if (fs.existsSync(bundled))
        return path.join(extRoot, 'codequest');
    // Dev: extension lives at <repo>/extensions/vscode → pack at <repo>/codequest
    const dev = path.join(extRoot, '..', '..', 'codequest', 'bin', 'codequest');
    if (fs.existsSync(dev))
        return path.join(extRoot, '..', '..', 'codequest');
    return null;
}
function runScan(packRoot, workspaceRoot, engine) {
    const bin = path.join(packRoot, 'bin', 'codequest');
    const args = ['scan', workspaceRoot];
    if (engine === 'tree-sitter')
        args.push('--engine', 'tree-sitter');
    (0, child_process_1.execFileSync)(process.execPath, [bin, ...args], { stdio: 'pipe', timeout: 120000 });
    return path.join(workspaceRoot, '.codequest', 'graph.json');
}
class CodeQuestViewProvider {
    extRoot;
    constructor(extRoot) {
        this.extRoot = extRoot;
    }
    resolveWebviewView(view) {
        view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.file(this.extRoot)] };
        view.webview.onDidReceiveMessage(async (msg) => {
            if (msg?.command === 'openFile' && msg.path && vscode.workspace.workspaceFolders?.length) {
                const uri = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, msg.path));
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, { preview: true });
                }
                catch {
                    vscode.window.showWarningMessage(`CodeQuest: cannot open ${msg.path}`);
                }
            }
        });
        this.refresh(view);
    }
    refresh(view) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {
            view.webview.html = `<body style="background:#0a0a0c;color:#a1a1aa;font-family:sans-serif;padding:24px">Open a folder to use CodeQuest.</body>`;
            return;
        }
        const ws = folders[0].uri.fsPath;
        const packRoot = findPackRoot(this.extRoot);
        if (!packRoot) {
            view.webview.html = `<body style="background:#0a0a0c;color:#a1a1aa;font-family:sans-serif;padding:24px">CodeQuest analyzer not found.</body>`;
            return;
        }
        try {
            const engine = vscode.workspace.getConfiguration('codequest').get('engine', 'regex');
            const graphPath = runScan(packRoot, ws, engine);
            const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
            view.webview.html = this.htmlFor(view.webview, graph);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            view.webview.html = `<body style="background:#0a0a0c;color:#fda4af;font-family:sans-serif;padding:24px">CodeQuest scan failed:<br><pre>${msg.replace(/</g, '&lt;')}</pre></body>`;
        }
    }
    htmlFor(webview, graph) {
        const media = path.join(this.extRoot, 'media');
        let html = fs.readFileSync(path.join(media, 'index.html'), 'utf8');
        // Rewrite absolute asset URLs to webview URIs.
        html = html.replace(/(src|href)="\/assets\//g, (_m, attr) => {
            const uri = webview.asWebviewUri(vscode.Uri.file(path.join(media, 'assets')));
            return `${attr}="${uri}/`;
        });
        // VS Code webviews need relative base fixes for fetch('./...').
        const safe = JSON.stringify(graph).replace(/</g, '\\u003c');
        html = html.replace('</head>', `<base href="${webview.asWebviewUri(vscode.Uri.file(media))}/">\n<script>window.__CODEQUEST_GRAPH__=${safe};</script>\n</head>`);
        const csp = `default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};`;
        html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
        return html;
    }
}
function activate(ctx) {
    const provider = new CodeQuestViewProvider(ctx.extensionPath);
    ctx.subscriptions.push(vscode.window.registerWebviewViewProvider('codequest-view', provider));
    ctx.subscriptions.push(vscode.commands.registerCommand('codequest.scan', async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length)
            return vscode.window.showWarningMessage('CodeQuest: open a folder first.');
        const packRoot = findPackRoot(ctx.extensionPath);
        if (!packRoot)
            return vscode.window.showErrorMessage('CodeQuest: analyzer not found.');
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'CodeQuest: scanning…' }, async () => {
            try {
                const engine = vscode.workspace.getConfiguration('codequest').get('engine', 'regex');
                runScan(packRoot, folders[0].uri.fsPath, engine);
                vscode.window.showInformationMessage('CodeQuest: scan complete.');
            }
            catch (e) {
                vscode.window.showErrorMessage(`CodeQuest scan failed: ${e instanceof Error ? e.message : e}`);
            }
        });
    }), vscode.commands.registerCommand('codequest.openGraph', () => vscode.commands.executeCommand('codequest-view.focus')));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map