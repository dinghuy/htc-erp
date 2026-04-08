param(
  [switch]$Headed,
  [int]$CdpPort = 9222
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-CdpReady {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing "$Url/json/version" -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

function Get-BrowserCandidates {
  $candidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
  )

  return $candidates | Where-Object { Test-Path $_ }
}

function Wait-ForDevToolsActivePort {
  param(
    [Parameter(Mandatory = $true)]
    [string]$UserDataDir,

    [int]$TimeoutSeconds = 15
  )

  $activePortFile = Join-Path $UserDataDir 'DevToolsActivePort'
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    if (Test-Path $activePortFile) {
      $lines = Get-Content $activePortFile
      if ($lines.Length -ge 1 -and $lines[0]) {
        return [int]$lines[0]
      }
    }
    Start-Sleep -Milliseconds 500
  }

  return $null
}

$launchedProcess = $null
$launchedUserDataDir = $null
$cdpUrl = if ($env:QA_CDP_URL) { $env:QA_CDP_URL } else { "http://127.0.0.1:$CdpPort" }

if (-not (Test-CdpReady -Url $cdpUrl)) {
  $browserCandidates = Get-BrowserCandidates
  if (-not $browserCandidates -or $browserCandidates.Count -eq 0) {
    $env:QA_CDP_BOOTSTRAP_ERROR = "Unable to bootstrap a CDP browser for UX audit. No supported Chrome/Edge executable found."
  } else {
    $launchFailures = @()

    foreach ($browserPath in $browserCandidates) {
      $userDataDir = Join-Path $env:TEMP ("codex-ux-audit-cdp-" + [guid]::NewGuid().ToString('N'))
      $arguments = @(
        '--remote-debugging-address=127.0.0.1',
        '--remote-debugging-port=0',
        "--user-data-dir=$userDataDir",
        '--no-first-run',
        '--no-default-browser-check'
      )

      if ($env:QA_FORCE_HEADLESS -eq '1') {
        $arguments += '--headless=new'
      }

      $arguments += @(
        '--disable-background-networking',
        '--disable-sync',
        'about:blank'
      )

      $process = Start-Process -FilePath $browserPath -ArgumentList $arguments -PassThru
      $resolvedPort = Wait-ForDevToolsActivePort -UserDataDir $userDataDir
      if ($resolvedPort) {
        $candidateUrl = "http://127.0.0.1:$resolvedPort"
        if (Test-CdpReady -Url $candidateUrl) {
          $launchedProcess = $process
          $launchedUserDataDir = $userDataDir
          $cdpUrl = $candidateUrl
          break
        }
      }

      $exitHint = if ($process.HasExited) { " ExitCode=$($process.ExitCode)." } else { '' }
      $launchFailures += "$browserPath$exitHint"
      if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
      }
      if (Test-Path $userDataDir) {
        Remove-Item -LiteralPath $userDataDir -Recurse -Force -ErrorAction SilentlyContinue
      }
    }

    if (-not $launchedProcess) {
      $env:QA_CDP_BOOTSTRAP_ERROR = "Unable to bootstrap a CDP browser for UX audit. Tried: $($launchFailures -join ' | ')"
    }
  }
}

$env:QA_CDP_URL = $cdpUrl
if ($Headed) {
  $env:QA_HEADLESS = '0'
}

& node (Join-Path $PSScriptRoot 'run-ux-audit.mjs')
$nodeExitCode = $LASTEXITCODE

if ($launchedProcess -and -not $launchedProcess.HasExited) {
  Stop-Process -Id $launchedProcess.Id -Force
}

if ($launchedUserDataDir -and (Test-Path $launchedUserDataDir)) {
  Remove-Item -LiteralPath $launchedUserDataDir -Recurse -Force -ErrorAction SilentlyContinue
}

exit $nodeExitCode
