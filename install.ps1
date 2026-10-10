# Aperio one-line setup (Windows PowerShell — run as admin for the Node install step):
#   irm https://raw.githubusercontent.com/abicevoice1-sudo/Aperio/main/install.ps1 | iex
Write-Host "→ Aperio setup"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "→ Node.js not found — installing…"
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
Write-Host "→ node $(node --version)"

Write-Host "→ installing aperio…"
npm install -g aperio

Write-Host "→ launching…"
aperio start @args
