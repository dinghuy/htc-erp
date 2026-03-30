Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-Url {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Url
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 5
    return [pscustomobject]@{
      Url = $Url
      Ok = $true
      Status = $response.StatusCode
      Detail = 'reachable'
    }
  } catch {
    return [pscustomobject]@{
      Url = $Url
      Ok = $false
      Status = ''
      Detail = $_.Exception.Message
    }
  }
}

$results = @(
  Test-Url 'http://127.0.0.1:3001/api/health'
  Test-Url 'http://127.0.0.1:4173'
)

$results | Format-Table -AutoSize

if ($results.Where({ -not $_.Ok }).Count -gt 0) {
  exit 1
}
