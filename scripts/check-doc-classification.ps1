$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$docsRoot = Join-Path $repoRoot 'docs'
$indexPath = Join-Path $docsRoot 'index.md'

if (-not (Test-Path -LiteralPath $indexPath)) {
    throw "Missing docs index: $indexPath"
}

$indexContent = Get-Content -LiteralPath $indexPath -Raw
$matches = [regex]::Matches($indexContent, '`([^`]+)`')
$docsPathPrefixes = @(
    'product/', 'architecture/', 'adr/', 'domain/', 'api/', 'process/', 'qa/', 'runbooks/', 'ai/', 'workstreams/'
)

$classified = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
$indexedPaths = New-Object 'System.Collections.Generic.List[string]'
foreach ($match in $matches) {
    $value = $match.Groups[1].Value
    $looksLikeManagedPath = $false
    if ($value -match '^[A-Za-z0-9._/-]+$') {
        if ($value.StartsWith('docs/') -or $value.StartsWith('archive/') -or $value.StartsWith('tmp/')) {
            $looksLikeManagedPath = $true
        } elseif ($docsPathPrefixes | Where-Object { $value.StartsWith($_) }) {
            $looksLikeManagedPath = $true
        }
    }

    if ($looksLikeManagedPath) {
        if ($value.StartsWith('docs/') -or $value.StartsWith('archive/') -or $value.StartsWith('tmp/')) {
            $normalized = $value.Replace('/', '\').TrimEnd('\')
        } else {
            $normalized = ('docs/' + $value).Replace('/', '\').TrimEnd('\')
        }
        $indexedPaths.Add($normalized) | Out-Null
        if ($normalized.StartsWith('docs\')) {
            [void]$classified.Add($normalized)
        }
    }
}

[void]$classified.Add('docs\index.md')
[void]$classified.Add('docs\AGENTS.md')
[void]$classified.Add('docs\workstreams\AGENTS.md')

$missingPaths = $indexedPaths | Where-Object { -not (Test-Path -LiteralPath (Join-Path $repoRoot $_)) } | Sort-Object -Unique

$allDocsFiles = Get-ChildItem -Path $docsRoot -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($repoRoot.Length + 1)
    $relative.Replace('/', '\')
}

$unclassified = $allDocsFiles | Where-Object { -not $classified.Contains($_) } | Sort-Object

if ($missingPaths.Count -gt 0) {
    Write-Host 'Indexed paths that do not exist:' -ForegroundColor Yellow
    $missingPaths | ForEach-Object { Write-Host " - $_" }
    Write-Host ''
    Write-Host 'Fix docs/index.md or restore/move the referenced target.'
    exit 1
}

if ($unclassified.Count -gt 0) {
    Write-Host 'Unclassified docs files found:' -ForegroundColor Yellow
    $unclassified | ForEach-Object { Write-Host " - $_" }
    Write-Host ''
    Write-Host 'Classify each file by either:' -ForegroundColor Yellow
    Write-Host ' - linking it from docs/index.md as active material'
    Write-Host ' - moving it to archive/'
    Write-Host ' - moving it to tmp/'
    exit 1
}

Write-Host 'All docs files are classified, and docs/index.md has no dead path references.' -ForegroundColor Green
