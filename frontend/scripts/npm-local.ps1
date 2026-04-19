param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$npmCmd = 'C:\Program Files\nodejs\npm.cmd'

if (-not (Test-Path $npmCmd)) {
  throw "Cannot find npm.cmd at $npmCmd"
}

# Use the bundled npm.cmd path to bypass the broken npm.ps1 wrapper on Windows.
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
  throw 'LOCALAPPDATA is not set; cannot configure npm cache path.'
}
$env:npm_config_cache = Join-Path $env:LOCALAPPDATA 'npm-cache'
New-Item -ItemType Directory -Force -Path $env:npm_config_cache | Out-Null

& $npmCmd @Args
exit $LASTEXITCODE
