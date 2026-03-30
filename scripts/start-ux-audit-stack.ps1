Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'

$backendCommand = 'title CRM_UX_AUDIT_BACKEND && npm run dev'
$frontendRunner = Join-Path $frontendDir 'scripts\npm-local.ps1'
$frontendCommand = "title CRM_UX_AUDIT_FRONTEND && powershell -NoProfile -ExecutionPolicy Bypass -File `"$frontendRunner`" run dev:qa"

Start-Process -FilePath 'cmd.exe' -WorkingDirectory $backendDir -ArgumentList '/k', $backendCommand
Start-Process -FilePath 'cmd.exe' -WorkingDirectory $frontendDir -ArgumentList '/k', $frontendCommand

Write-Host 'Started backend dev server and frontend QA dev server.'
Write-Host 'Backend:  http://127.0.0.1:3001'
Write-Host 'Frontend: http://127.0.0.1:4173'
