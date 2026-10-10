# CodeQuest one-line setup (Windows PowerShell — run as admin for the Node install step):
#   irm https://raw.githubusercontent.com/abicevoice1-sudo/CodeQuest/main/install.ps1 | iex
Write-Host "→ CodeQuest setup"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "→ Node.js not found — installing…"
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
Write-Host "→ node $(node --version)"

Write-Host "→ installing codequest-ai…"
npm install -g codequest-ai

Write-Host "→ launching…"
codequest start @args
