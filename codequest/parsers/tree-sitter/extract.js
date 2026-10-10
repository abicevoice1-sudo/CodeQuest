#!/usr/bin/env node
/**
 * CodeQuest tree-sitter engine — AST-accurate import/export extraction.
 *
 * Optional enhancement over the zero-dependency regex scanner in bin/codequest.
 * Usage:  node extract.js <dir>    → JSON array on stdout:
 *   [{ rel, lang, lines, imports: [{raw, line}], exports: [...] }]
 *
 * The AST identifies *which statements are imports* (zero false positives from
 * comments/strings/multiline); module names are then read off those statements.
 * bin/codequest consumes this output and keeps its own resolution, graph,
 * risk, and cycle logic — the graph.json contract is unchanged.
 *
 * Install once:  cd codequest/parsers/tree-sitter && npm install
 * Use:           ./codequest/bin/codequest scan --engine tree-sitter
 */
'use strict';

const fs = require('fs');
const path = require('path');

let Parser;
try {
  Parser = require('tree-sitter');
} catch {
  console.error('codequest: tree-sitter engine needs its dependencies.\n' +
    '  cd codequest/parsers/tree-sitter && npm install   (try --legacy-peer-deps on conflict)');
  process.exit(2);
}

const GRAMMARS = {};
function grammar(lang) {
  if (GRAMMARS[lang]) return GRAMMARS[lang];
  let mod = null;
  try {
    if (lang === 'javascript') mod = require('tree-sitter-javascript');
    else if (lang === 'typescript') mod = require('tree-sitter-typescript').typescript;
    else if (lang === 'tsx') mod = require('tree-sitter-typescript/tsx');
    else if (lang === 'python') mod = require('tree-sitter-python');
  } catch { /* grammar not installed */ }
  GRAMMARS[lang] = mod;
  return mod;
}

const QUERIES = {
  // JS/TS/TSX: AST-identified import/export statements.
  // className differs per grammar (identifier in JS, type_identifier in TS/TSX).
  js: (className) => `
    (import_statement source: (string) @src)
    (export_statement source: (string) @src)
    (call_expression function: (identifier) @fn arguments: (arguments (string) @src))
    (call_expression function: (import) arguments: (arguments (string) @src))
    (export_statement declaration: (function_declaration name: (identifier) @exp))
    (export_statement declaration: (generator_function_declaration name: (identifier) @exp))
    (export_statement declaration: (class_declaration name: (${className}) @exp))
    (export_statement declaration: (lexical_declaration (variable_declarator name: (identifier) @exp)))
    (export_specifier name: (identifier) @exp)
    (export_specifier alias: (identifier) @expAlias)
    (assignment_expression
      left: (member_expression object: (identifier) @modObj property: (property_identifier) @modProp))
  `,
  // Python: AST-identified import statements + top-level defs.
  python: `
    (import_statement) @imp
    (import_from_statement) @imp
    (module (function_definition name: (identifier) @exp))
    (module (class_definition name: (identifier) @exp))
  `,
};

const stripQuotes = (s) => s.replace(/^['"`]|['"`]$/g, '');
const lineOf = (node) => node.startPosition.row + 1;

function extractJS(tree, lang) {
  const imports = [], exports = [];
  const className = lang === 'javascript' ? 'identifier' : 'type_identifier';
  const q = new Parser.Query(grammar(lang), QUERIES.js(className));
  const seen = new Set();
  for (const cap of q.captures(tree.rootNode)) {
    const n = cap.node;
    if (cap.name === 'src') {
      // require('x') filter: only when the call target is `require` or `import`.
      const parent = n.parent; // arguments
      const call = parent && parent.parent;
      if (call && call.type === 'call_expression') {
        const fn = call.childForFieldName('function');
        const fnText = fn ? fn.text : '';
        if (fnText !== 'require' && fn.type !== 'import') continue;
      }
      const key = `i:${lineOf(n)}:${n.text}`;
      if (!seen.has(key)) { seen.add(key); imports.push({ raw: stripQuotes(n.text), line: lineOf(n) }); }
    } else if (cap.name === 'exp' || cap.name === 'expAlias') {
      exports.push(n.text);
    } else if (cap.name === 'modObj' && n.text === 'module') {
      // module.exports / module.exports.name — find the sibling property capture
      // (handled below via modProp on the same statement)
    } else if (cap.name === 'modProp') {
      const stmt = n;
      let p = stmt.parent;
      while (p && p.type !== 'expression_statement') p = p.parent;
      if (p) exports.push(n.text);
    }
  }
  return { imports, exports: [...new Set(exports)] };
}

function extractPython(tree) {
  const imports = [], exports = [];
  const q = new Parser.Query(grammar('python'), QUERIES.python);
  const reImp = /^\s*import\s+(.+)$/;
  const reFrom = /^\s*from\s+(\.*[a-zA-Z_]?[\w.]*)\s+import\s+(.+)$/;
  for (const cap of q.captures(tree.rootNode)) {
    const n = cap.node;
    if (cap.name === 'imp') {
      const text = n.text.split('\n')[0];
      const line = lineOf(n);
      let m;
      if ((m = text.match(reImp))) {
        m[1].split(',').forEach(s =>
          imports.push({ raw: s.trim().split(/\s+as\s+/)[0].trim(), line }));
      } else if ((m = text.match(reFrom))) {
        imports.push({ raw: (m[1].trim() || '.'), line, names: m[2].trim(), relative: m[1].startsWith('.') });
      }
    } else if (cap.name === 'exp') {
      exports.push(n.text);
    }
  }
  return { imports, exports };
}

const EXT_LANG = { '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript', '.tsx': 'tsx', '.py': 'python' };
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.codequest']);

function walk(dir, root, out) {
  out = out || [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, root, out);
    else if (e.isFile() && EXT_LANG[path.extname(e.name).toLowerCase()]) {
      out.push(path.relative(root, full));
    }
  }
  return out.sort();
}

function main() {
  const dir = path.resolve(process.argv[2] || '.');
  const parser = new Parser();
  const results = [];
  for (const rel of walk(dir, dir)) {
    const lang = EXT_LANG[path.extname(rel).toLowerCase()];
    const gram = grammar(lang === 'tsx' ? 'tsx' : lang);
    if (!gram) continue;
    parser.setLanguage(gram);
    const code = fs.readFileSync(path.join(dir, rel), 'utf8');
    const tree = parser.parse(code);
    const { imports, exports } = lang === 'python'
      ? extractPython(tree)
      : extractJS(tree, lang === 'tsx' ? 'tsx' : lang);
    results.push({ rel, lang: lang === 'tsx' ? 'typescript' : lang, lines: code.split('\n').length, imports, exports });
  }
  process.stdout.write(JSON.stringify(results));
}

main();
