#!/usr/bin/env bash
# CodeQuest one-line setup (macOS / Linux):
#   curl -fsSL https://raw.githubusercontent.com/abicevoice1-sudo/CodeQuest/main/install.sh | bash
set -e
echo "→ CodeQuest setup"

if ! command -v node >/dev/null 2>&1; then
  echo "→ Node.js not found — installing…"
  if command -v brew >/dev/null 2>&1; then
    brew install node
  elif command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y nodejs >/dev/null 2>&1
  elif command -v dnf >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo dnf install -y nodejs >/dev/null 2>&1
  else
    echo "  couldn't install Node.js automatically."
    echo "  get Node 18+ from https://nodejs.org, then re-run this command."
    exit 1
  fi
fi
echo "→ node $(node --version)"

echo "→ installing codequest-ai…"
npm install -g codequest-ai

echo "→ launching…"
codequest start "$@"
