$ErrorActionPreference = "Stop"

$cacheDir = Join-Path (Split-Path -Parent $PSScriptRoot) "npm-cache"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

$env:npm_config_cache = $cacheDir
$env:NPM_CONFIG_CACHE = $cacheDir

$nodeExe = "C:\Program Files\nodejs\node.exe"
$npxCli = "C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js"

if ((Test-Path $nodeExe) -and (Test-Path $npxCli)) {
  & $nodeExe $npxCli "-y" "@playwright/mcp@latest" @args
  exit $LASTEXITCODE
}

& npx "-y" "@playwright/mcp@latest" @args
exit $LASTEXITCODE
