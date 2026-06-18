param(
  [switch]$Stop,
  [switch]$Build,
  [switch]$Start,
  [switch]$Restart,
  [switch]$Validate,
  [int]$ApiPort = 5191,
  [int]$MobilePort = 5175
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ArtifactDir = Join-Path $RepoRoot "artifacts\oam\local-environment"

function Stop-PortProcess {
  param([int[]]$Ports)
  $connections = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    if ($processId -and $processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Invoke-Native {
  param([string]$Command, [string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE"
  }
}

function Build-Workspace {
  Push-Location $RepoRoot
  try {
    Invoke-Native "dotnet" @("build", "services/core-api/WorkOS.Api/WorkOS.Api.csproj", "--no-restore")
    Invoke-Native "npm" @("--prefix", "apps/mobile", "run", "build")
  } finally {
    Pop-Location
  }
}

function Start-Workspace {
  New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null
  $apiOutLog = Join-Path $ArtifactDir "api.out.log"
  $apiErrLog = Join-Path $ArtifactDir "api.err.log"
  $mobileOutLog = Join-Path $ArtifactDir "mobile.out.log"
  $mobileErrLog = Join-Path $ArtifactDir "mobile.err.log"
  Start-Process -FilePath "dotnet" -ArgumentList @("run", "--project", "services/core-api/WorkOS.Api/WorkOS.Api.csproj", "--urls", "http://127.0.0.1:$ApiPort") -WorkingDirectory $RepoRoot -RedirectStandardOutput $apiOutLog -RedirectStandardError $apiErrLog -WindowStyle Hidden
  Start-Process -FilePath "npm" -ArgumentList @("--prefix", "apps/mobile", "run", "dev", "--", "--host", "127.0.0.1", "--port", "$MobilePort") -WorkingDirectory $RepoRoot -RedirectStandardOutput $mobileOutLog -RedirectStandardError $mobileErrLog -WindowStyle Hidden
}

function Test-Workspace {
  Push-Location $RepoRoot
  try {
    Invoke-Native "node" @("scripts/oam/check-dormitory-active-path-gate.mjs")
    Invoke-Native "node" @("scripts/oam/check-dormitory-operation-execution-contract.mjs")
    Invoke-Native "node" @("scripts/oam/check-dormitory-ci-hard-gates.mjs")
  } finally {
    Pop-Location
  }
}

if (-not ($Stop -or $Build -or $Start -or $Restart -or $Validate)) {
  $Restart = $true
  $Build = $true
  $Validate = $true
}

if ($Restart) { $Stop = $true; $Start = $true }
if ($Stop) { Stop-PortProcess -Ports @($ApiPort, $MobilePort) }
if ($Build) { Build-Workspace }
if ($Start) { Start-Workspace }
if ($Validate) { Test-Workspace }

Write-Host "Dormitory local test environment manager: PASS"
