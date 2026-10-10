#!/usr/bin/env bash
# Build + package the CodeQuest VS Code extension from source.
# Usage: ./build.sh   (run from extensions/vscode/)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

echo "→ building visualizer…"
(cd "$ROOT/visualizer" && npm install --no-audit --no-fund && npm run build)

echo "→ refreshing extension media…"
rm -rf "$HERE/media"
cp -r "$ROOT/visualizer/dist" "$HERE/media"

echo "→ bundling analyzer…"
rm -rf "$HERE/codequest"
mkdir -p "$HERE/codequest"
cp -r "$ROOT/codequest/bin" "$ROOT/codequest/lib" "$ROOT/codequest/CODEQUEST.md" "$ROOT/codequest/AGENTS.md" \
    "$ROOT/codequest/.github" "$ROOT/codequest/skills" "$ROOT/codequest/templates" \
    "$ROOT/codequest/ci" "$ROOT/codequest/mcp-server.js" "$ROOT/codequest/mcp.example.json" \
    "$ROOT/codequest/parsers" "$ROOT/codequest/README.md" "$HERE/codequest/"
find "$HERE/codequest" -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true

echo "→ compiling extension…"
(cd "$HERE" && npm install --no-audit --no-fund && npx tsc -p tsconfig.json)

echo "→ packaging…"
(cd "$HERE" && npx --yes @vscode/vsce package --no-dependencies)

echo "✓ done: $(ls "$HERE"/*.vsix)"
