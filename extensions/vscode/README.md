# CodeQuest for VS Code

CodeQuest AI inside VS Code: dependency graph sidebar, blast-radius view, click-to-file.

## Install

- From the `.vsix` in this folder: `code --install-extension codequest-1.1.0.vsix`
- Or search the Marketplace for "CodeQuest" (once published).

## Use

1. Open any repo folder.
2. Open the **CodeQuest** view in the Explorer sidebar — it scans automatically.
3. Click any module → inspector; **Show blast radius** → impact view; **Open in editor** jumps to the file.
4. Command palette: **CodeQuest: Scan workspace** to re-scan.

## Settings

- `codequest.engine`: `regex` (default, zero-dep) or `tree-sitter` (needs `codequest/parsers/tree-sitter` npm install).

## Rebuild from source

```bash
# 1. Build the visualizer
cd visualizer && npm install && npm run build && cd ..
# 2. Refresh extension media + bundled analyzer
rm -rf extensions/vscode/media && cp -r visualizer/dist extensions/vscode/media
# 3. Compile + package
cd extensions/vscode && npx tsc -p tsconfig.json && npx vsce package
```
