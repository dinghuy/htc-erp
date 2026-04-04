param(
  [string[]]$Skill,
  [switch]$All,
  [switch]$Clean,
  [switch]$List,
  [string]$SourceRoot,
  [string]$DestinationRoot
)

$ErrorActionPreference = "Stop"

function Resolve-SkillsRoot {
  param([string]$ExplicitRoot)

  if ($ExplicitRoot) {
    return $ExplicitRoot
  }

  if ($env:CODEX_HOME) {
    return Join-Path $env:CODEX_HOME "skills"
  }

  return Join-Path (Join-Path $env:USERPROFILE ".codex") "skills"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$resolvedSourceRoot = Resolve-SkillsRoot -ExplicitRoot $SourceRoot
$resolvedDestinationRoot = if ($DestinationRoot) {
  $DestinationRoot
} else {
  Join-Path (Join-Path $repoRoot "tmp") "skills-global"
}

if (-not (Test-Path $resolvedSourceRoot)) {
  throw "Global skills root not found: $resolvedSourceRoot"
}

$availableSkills = Get-ChildItem -Path $resolvedSourceRoot -Directory | Sort-Object Name

if ($List) {
  $availableSkills | Select-Object -ExpandProperty Name
  exit 0
}

if (-not $All -and (-not $Skill -or $Skill.Count -eq 0)) {
  throw "Specify -Skill <name> or -All. Use -List to inspect available global skills."
}

$selectedSkills = if ($All) {
  $availableSkills
} else {
  $requested = $Skill | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  $missing = @()
  $found = foreach ($skillName in $requested) {
    $match = $availableSkills | Where-Object { $_.Name -eq $skillName } | Select-Object -First 1
    if ($null -eq $match) {
      $missing += $skillName
      continue
    }

    $match
  }

  if ($missing.Count -gt 0) {
    throw "Missing global skills: $($missing -join ', ')"
  }

  $found
}

New-Item -ItemType Directory -Force -Path $resolvedDestinationRoot | Out-Null

if ($Clean) {
  $selectedNames = $selectedSkills | Select-Object -ExpandProperty Name
  $existingMirrors = Get-ChildItem -Path $resolvedDestinationRoot -Directory -ErrorAction SilentlyContinue

  foreach ($existingMirror in $existingMirrors) {
    if ($selectedNames -notcontains $existingMirror.Name) {
      Remove-Item -LiteralPath $existingMirror.FullName -Recurse -Force
    }
  }
}

foreach ($skillDir in $selectedSkills) {
  $targetDir = Join-Path $resolvedDestinationRoot $skillDir.Name

  if (Test-Path $targetDir) {
    Remove-Item -LiteralPath $targetDir -Recurse -Force
  }

  Copy-Item -LiteralPath $skillDir.FullName -Destination $targetDir -Recurse -Force
}

Write-Output "Source: $resolvedSourceRoot"
Write-Output "Destination: $resolvedDestinationRoot"
Write-Output "Mirrored skills:"
$selectedSkills | Select-Object -ExpandProperty Name
