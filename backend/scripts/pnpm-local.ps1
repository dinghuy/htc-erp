param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$corepackCmd = 'C:\Program Files\nodejs\corepack.cmd'

if (-not (Test-Path $corepackCmd)) {
  throw "Cannot find corepack.cmd at $corepackCmd"
}

& $corepackCmd pnpm --dir $projectRoot @Args
exit $LASTEXITCODE
