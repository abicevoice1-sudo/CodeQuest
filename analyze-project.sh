#!/bin/bash
# ============================================================
#  CodeQuest — One-Click Server  (personal use)
#  Double-click (or run) this file. That's it.
#
#  Folder layout it expects:
#    YourFolder/
#      CodeQuest/      <- this repo (where this file lives)
#      project/        <- the project to analyze
#
#  It starts the CodeQuest server on your project and opens
#  http://127.0.0.1:1337 in your browser. Fully offline.
#  Press Ctrl+C to stop it.
# ============================================================
set -e

CQDIR="$(cd "$(dirname "$0")" && pwd)"

# --- Check for Node.js ---
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  [CodeQuest] Node.js is not installed."
  echo ""
  echo "  Install it free from https://nodejs.org (pick the LTS version),"
  echo "  then run this file again."
  echo ""
  exit 1
fi

# --- Find the project folder: ../project, or first sibling dir ---
PROJECT="$CQDIR/../project"
if [ ! -d "$PROJECT" ]; then
  PROJECT=""
  for d in "$CQDIR"/../*/; do
    name="$(basename "$d")"
    if [ "$name" != "CodeQuest" ] && [ -d "$d" ]; then
      PROJECT="$d"
      break
    fi
  done
fi
if [ -z "$PROJECT" ] || [ ! -d "$PROJECT" ]; then
  echo ""
  echo "  [CodeQuest] Couldn't find a project folder next to CodeQuest."
  echo ""
  echo "  Make a folder like this:"
  echo "    YourFolder/"
  echo "      CodeQuest/   (this repo)"
  echo "      project/     (the code you want analyzed)"
  echo ""
  exit 1
fi

echo ""
echo "  [CodeQuest] Starting server for \"$PROJECT\"..."
echo "  [CodeQuest] Press Ctrl+C to stop."
echo ""

# --- Start the server in the background, open the browser ---
node "$CQDIR/codequest/bin/codequest" visualize "$PROJECT" &
SERVER_PID=$!
sleep 3

if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:1337"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://127.0.0.1:1337"
else
  echo "  Open this URL in your browser: http://127.0.0.1:1337"
fi

wait $SERVER_PID
