# CodeQuest tree-sitter engine (optional)

AST-accurate import/export extraction for JavaScript, TypeScript, TSX, and Python —
a drop-in upgrade over the zero-dependency regex scanner in `bin/codequest`.

## Why

The default scanner is regex-based: fast, zero-dep, offline, but blind to commented-out
imports, strings that look like imports, and exotic syntax. The tree-sitter engine parses
real ASTs, so **import statements are identified structurally — zero false positives** —
then reads module names off those statements. Everything downstream (resolution, graph,
risk, cycles, `diff`, MCP tools, prompts) is unchanged: the `.codequest/graph.json`
contract is identical.

## Install

```bash
cd codequest/parsers/tree-sitter && npm install
# on peer-dependency conflict: npm install --legacy-peer-deps
```

## Use

```bash
./codequest/bin/codequest scan --engine tree-sitter
```

Per-file fallback: languages the engine doesn't cover (Go, Java, Ruby, PHP) automatically
fall back to the regex scanner, so mixed repos just work. The scan records
`"engine": "tree-sitter"` in `graph.json` and the repo map.

## Verify

```bash
node --test codequest/tests/   # includes regex ⇄ tree-sitter edge-parity test
```
