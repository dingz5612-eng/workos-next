$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$logDir = Join-Path $root "artifacts/oam/test-results/real-browser-services"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Start-HiddenProcess {
  param(
    [Parameter(Mandatory = $true)][string] $FilePath,
    [Parameter(Mandatory = $true)][string[]] $ArgumentList,
    [Parameter(Mandatory = $true)][string] $WorkingDirectory,
    [Parameter(Mandatory = $true)][string] $StdoutPath,
    [Parameter(Mandatory = $true)][string] $StderrPath
  )

  $arguments = @{
    FilePath = $FilePath
    ArgumentList = $ArgumentList
    WorkingDirectory = $WorkingDirectory
    RedirectStandardOutput = $StdoutPath
    RedirectStandardError = $StderrPath
    PassThru = $true
  }
  if ($IsWindows) {
    $arguments.WindowStyle = "Hidden"
  }
  Start-Process @arguments
}

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string] $Command,
    [string[]] $Arguments = @()
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
  }
}

function Wait-HttpOk {
  param(
    [Parameter(Mandatory = $true)][string] $Url,
    [Parameter(Mandatory = $true)][string] $Name
  )

  $last = $null
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      $last = $_.Exception.Message
    }
    Start-Sleep -Seconds 1
  }
  throw "$Name did not become ready at $Url. Last error: $last"
}

function Get-PortFromUrl {
  param(
    [Parameter(Mandatory = $true)][string] $Url,
    [Parameter(Mandatory = $true)][int] $DefaultPort
  )

  try {
    $uri = [System.Uri]::new($Url)
    if ($uri.Port -gt 0) {
      return $uri.Port
    }
  } catch {
    return $DefaultPort
  }
  return $DefaultPort
}

function Stop-TestPortProcesses {
  param([int[]] $Ports)

  $processIds = @()
  if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    $connections = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue
    $processIds += $connections | Select-Object -ExpandProperty OwningProcess -Unique
  } else {
    foreach ($port in $Ports) {
      if (Get-Command lsof -ErrorAction SilentlyContinue) {
        $output = & lsof "-tiTCP:$port" "-sTCP:LISTEN" 2>$null
        $processIds += (($output -join " ") -split "\s+")
      } elseif (Get-Command fuser -ErrorAction SilentlyContinue) {
        $output = & fuser -n tcp $port 2>$null
        $processIds += (($output -join " ") -split "\s+")
      }
    }
  }

  foreach ($processId in ($processIds | Where-Object { $_ -match "^\d+$" } | ForEach-Object { [int]$_ } | Sort-Object -Unique)) {
    if ($processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

if (-not $env:ASPNETCORE_ENVIRONMENT) { $env:ASPNETCORE_ENVIRONMENT = "Development" }
if (-not $env:ASPNETCORE_URLS) { $env:ASPNETCORE_URLS = "http://127.0.0.1:5191" }
if (-not $env:ConnectionStrings__WorkOSRuntime) { $env:ConnectionStrings__WorkOSRuntime = "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev" }
if (-not $env:WORKOS_REAL_BROWSER_USE_INMEMORY) {
  $env:WORKOS_REAL_BROWSER_USE_INMEMORY = "1"
}
if (-not $env:WORKOS_MOBILE_URL) { $env:WORKOS_MOBILE_URL = "http://127.0.0.1:5175" }
if (-not $env:WORKOS_API_URL) { $env:WORKOS_API_URL = "http://127.0.0.1:5191" }
if (-not $env:WORKOS_REAL_BROWSER_HEADLESS) { $env:WORKOS_REAL_BROWSER_HEADLESS = "1" }
if (-not $env:WORKOS_DORM_L1_AUDIT_RUN_ID) {
  $env:WORKOS_DORM_L1_AUDIT_RUN_ID = "dormitory-l1-browser-e2e-" + (Get-Date -Format "yyyyMMddHHmmss")
}

Stop-TestPortProcesses -Ports @(
  (Get-PortFromUrl -Url $env:WORKOS_API_URL -DefaultPort 5191),
  (Get-PortFromUrl -Url $env:WORKOS_MOBILE_URL -DefaultPort 5175)
)

$apiProject = Join-Path $root "services/core-api/WorkOS.Api/WorkOS.Api.csproj"
Invoke-Native -Command "dotnet" -Arguments @("build", $apiProject, "-c", "Release")

$apiDll = Join-Path $root "services/core-api/WorkOS.Api/bin/Release/net10.0/WorkOS.Api.dll"
$api = Start-HiddenProcess `
  -FilePath "dotnet" `
  -ArgumentList @($apiDll) `
  -WorkingDirectory $root `
  -StdoutPath (Join-Path $logDir "api.out.log") `
  -StderrPath (Join-Path $logDir "api.err.log")
$web = Start-HiddenProcess `
  -FilePath "node" `
  -ArgumentList @("node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5175") `
  -WorkingDirectory (Join-Path $root "apps/mobile") `
  -StdoutPath (Join-Path $logDir "mobile.out.log") `
  -StderrPath (Join-Path $logDir "mobile.err.log")

try {
  Wait-HttpOk -Url "$env:WORKOS_API_URL/health" -Name "Core API"
  Wait-HttpOk -Url $env:WORKOS_MOBILE_URL -Name "Mobile frontend"

  Invoke-Native -Command "node" -Arguments @("scripts/surface/run-dormitory-13-scenario-entry-browser-audit.mjs")
  Invoke-Native -Command "node" -Arguments @("scripts/surface/check-dormitory-13-scenario-entry-browser-audit.mjs")
  Invoke-Native -Command "node" -Arguments @("scripts/surface/run-dormitory-performance-recoverability-audit.mjs")
  Invoke-Native -Command "node" -Arguments @("scripts/surface/check-dormitory-performance-recoverability-audit.mjs")

  for ($scenario = 1; $scenario -le 13; $scenario++) {
    foreach ($kind in @("positive", "negative")) {
      Invoke-Native -Command "node" -Arguments @("scripts/surface/run-dormitory-scenario$scenario-$kind-browser-audit.mjs")
      Invoke-Native -Command "node" -Arguments @("scripts/surface/check-dormitory-scenario$scenario-$kind-browser-audit.mjs")
    }
  }

  Invoke-Native -Command "node" -Arguments @("scripts/surface/run-dormitory-prelaunch-ops-trial.mjs")
  Invoke-Native -Command "node" -Arguments @("scripts/surface/check-dormitory-prelaunch-ops-trial.mjs")
  Invoke-Native -Command "node" -Arguments @("scripts/surface/generate-dormitory-final-frontend-ux-acceptance.mjs")
} finally {
  foreach ($process in @($web, $api)) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Output "Dormitory 13-scenario current real-browser hard gate: PASS"
