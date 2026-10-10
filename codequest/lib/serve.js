'use strict';
/* `codequest visualize` — scan the repo, serve the visualizer, open the browser. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { out, fail } = require('./util');
const { buildGraph, runTreeSitterExtract } = require('./scan');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function openBrowser(url, quiet) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err && !quiet) out(`open this URL in your browser: ${url}`);
    if (err && quiet) console.error(`open this URL in your browser: ${url}`);
  });
}

function cmdVisualize(dir, packRoot, flags) {
  // Always re-scan so the graph matches the code on disk (fast: ~0.2s/250 modules).
  const engine = flags.engine === 'tree-sitter' ? 'tree-sitter' : 'regex';
  let extracted = null;
  if (engine === 'tree-sitter') {
    try { extracted = runTreeSitterExtract(dir); }
    catch (e) { return fail('tree-sitter engine failed: ' + e.message, flags.json); }
  }
  const g = buildGraph(dir, extracted);
  g.engine = engine;
  const cq = path.join(dir, '.codequest');
  fs.mkdirSync(cq, { recursive: true });
  fs.writeFileSync(path.join(cq, 'graph.json'), JSON.stringify(g, null, 2));

  const visDir = path.join(packRoot, 'visualizer');
  if (!fs.existsSync(path.join(visDir, 'index.html'))) {
    return fail('visualizer not bundled with this install — reinstall codequest-ai or build visualizer/', flags.json);
  }

  // Inject the graph so the app boots straight into this repo (no file picker).
  const html = buildPage(visDir, g);

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '/index.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return res.end(html);
    }
    const f = path.normalize(path.join(visDir, urlPath));
    if (!f.startsWith(visDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}`;
    if (!flags.json) out(`codequest: visualizer live at ${url}  —  Ctrl+C to stop`);
    else out(JSON.stringify({ url }));
    openBrowser(url, !!flags.json);
  });
  server.on('error', (e) => fail('visualizer server failed: ' + e.message, flags.json));
}

function buildPage(visDir, graph) {
  const safe = JSON.stringify(graph).replace(/</g, '\\u003c');
  return fs.readFileSync(path.join(visDir, 'index.html'), 'utf8')
    .replace('</head>', `<script>window.__CODEQUEST_GRAPH__=${safe};</script>\n</head>`);
}

module.exports = { cmdVisualize, buildPage };
