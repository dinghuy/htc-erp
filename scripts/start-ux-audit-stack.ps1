Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'

Start-Process -FilePath 'cmd.exe' -WorkingDirectory $backendDir -ArgumentList '/k', 'npm run dev'
Start-Process -FilePath 'powershell.exe' -WorkingDirectory $frontendDir -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $frontendDir 'scripts\npm-local.ps1'), 'run', 'dev:qa'

Write-Host 'Started backend dev server and frontend QA dev server.'
Write-Host 'Backend:  http://127.0.0.1:3001'
Write-Host 'Frontend: http://127.0.0.1:4173'
