Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$killed = New-Object System.Collections.Generic.List[object]

try {
  $tasks = cmd /c 'tasklist /v /fo csv 2>nul' | ConvertFrom-Csv
  $tasks |
    Where-Object { $_.'Window Title' -like 'CRM_UX_AUDIT_*' } |
    ForEach-Object {
      try {
        $pid = [int] $_.PID
        Stop-Process -Id $pid -Force -ErrorAction Stop
        $killed.Add([pscustomobject]@{
          ProcessId = $pid
          Pattern = $_.'Window Title'
          Name = $_.'Image Name'
        }) | Out-Null
      } catch {
      }
    }
} catch {
}

if ($killed.Count -eq 0) {
  try {
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.CommandLine -and (
          $_.CommandLine -like '*CRM_UX_AUDIT_BACKEND*' -or
          $_.CommandLine -like '*CRM_UX_AUDIT_FRONTEND*' -or
          $_.CommandLine -like '*npm-local.ps1*run dev:qa*'
        )
      } |
      ForEach-Object {
        try {
          Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
          $killed.Add([pscustomobject]@{
            ProcessId = $_.ProcessId
            Pattern = 'commandline-fallback'
            Name = $_.Name
          }) | Out-Null
        } catch {
        }
      }
  } catch {
  }
}

if ($killed.Count -eq 0) {
  Write-Host 'No UX audit stack processes found.'
  exit 0
}

$killed | Sort-Object ProcessId -Unique | Format-Table -AutoSize
