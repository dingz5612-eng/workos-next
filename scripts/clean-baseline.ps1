$ErrorActionPreference = "Stop"

function Fail($message) {
  Write-Error $message
  exit 1
}

function Invoke-Checked($command, $arguments) {
  & $command @arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "$command failed: $($arguments -join ' ')"
  }
}

function Assert-RipgrepAvailable {
  if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
    Fail "ripgrep (rg) is required for OAM source hygiene checks."
  }
}

function Assert-NoMatches($paths, $pattern, $message, $excludePattern = $null) {
  $existing = @($paths | Where-Object { Test-Path $_ })
  if ($existing.Count -eq 0) {
    return
  }

  $matches = rg -n $pattern $existing 2>$null
  if ($LASTEXITCODE -eq 1) {
    return
  }
  if ($LASTEXITCODE -ne 0) {
    Fail "rg failed while checking: $message"
  }

  if ($excludePattern) {
    $matches = $matches | Where-Object { $_ -notmatch $excludePattern }
  }

  if ($matches) {
    $matches
    Fail $message
  }
}

Assert-RipgrepAvailable

Invoke-Checked "pwsh" @("scripts/guard-architecture.ps1")

Assert-NoMatches @("apps", "services", "tests") "scenarioFlows|data-task|data-scenario|taskView|objectView" "Old page/task/object model terms must not remain in current OAM source."
Assert-NoMatches @("docs") "local scaffold currently targets net9\.0" "Stale .NET scaffold documentation is forbidden."
Assert-NoMatches @("services/core-api/WorkOS.Api/Program.cs", "docs/contracts/workos-runtime.openapi.json") "/api/workspaces/\{workspaceId\}/cards/\{cardId\}/(prepare|confirm)" "Retired Workspace/Card write endpoints must stay absent."
Assert-NoMatches @(".github", "docs/oam", "docs/contracts/oam.current.json") "GateResult|WON-18" "Current OAM authority surfaces must not use retired gate names."

$solutionText = (Get-Content "WorkOSNext.sln" -Raw) -replace "\\", "/"
$repoRoot = (Get-Location).Path
$unreferencedProjects = Get-ChildItem -Recurse -Filter "*.csproj" -Path "services", "tests" |
  Where-Object {
    $relativePath = [System.IO.Path]::GetRelativePath($repoRoot, $_.FullName) -replace "\\", "/"
    $solutionText -notmatch [regex]::Escape($relativePath)
  }
if ($unreferencedProjects) {
  $unreferencedProjects | ForEach-Object { $_.FullName }
  Fail "Every active .csproj under services or tests must be referenced by WorkOSNext.sln."
}

Write-Host "OAM source hygiene: PASS"
exit 0
