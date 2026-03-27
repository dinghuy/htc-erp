param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$playwrightCmd = Join-Path $projectRoot 'node_modules\.bin\playwright.cmd'

if (-not (Test-Path $playwrightCmd)) {
  throw "Cannot find Playwright at $playwrightCmd. Run .\scripts\npm-local.ps1 install first."
}

# Keep browser downloads inside the project to avoid AppData permission issues.
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $projectRoot '.playwright-browsers'
New-Item -ItemType Directory -Force -Path $env:PLAYWRIGHT_BROWSERS_PATH | Out-Null

& $playwrightCmd @Args
exit $LASTEXITCODE
