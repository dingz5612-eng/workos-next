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

function Assert-Exists($path) {
  if (-not (Test-Path $path)) {
    Fail "Required OMA artifact is missing: $path"
  }
}

function Assert-RipgrepAvailable {
  if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
    Fail "ripgrep (rg) is required for OMA architecture checks."
  }
}

function Assert-OnlyDirectories($root, $allowed) {
  Assert-Exists $root
  $actual = Get-ChildItem $root -Directory | Select-Object -ExpandProperty Name
  foreach ($name in $actual) {
    if ($allowed -notcontains $name) {
      Fail "$root/$name is not allowed by current OMA."
    }
  }
}

function Assert-NoFile($path) {
  if (Test-Path $path) {
    Fail "Retired file or directory must be deleted: $path"
  }
}

function Join-Parts($parts) {
  return ($parts -join "")
}

Assert-RipgrepAvailable

Assert-Exists "docs/oma/current-architecture.md"
Assert-Exists "docs/oma/current-architecture.manifest.json"
Assert-Exists "docs/contracts/oma.current.json"
Assert-Exists "docs/system/current-system-map.md"
Assert-Exists "docs/business/experience-contract.yml"
Assert-Exists "docs/surface/surface-contract.yml"
Assert-Exists ".github/pull_request_template.md"
Assert-Exists ".github/workflows/ci.yml"
Assert-Exists "infra/docker-compose.yml"
Assert-Exists "infra/db/migrations"
Assert-Exists "services/core-api"
Assert-Exists "packages/surface-view-models"
foreach ($module in @("accommodation", "finance-gate", "identity", "maintenance")) {
  Assert-Exists "modules/$module/oma-module.manifest.json"
}

Assert-OnlyDirectories "services" @("core-api")
Assert-OnlyDirectories "modules" @("accommodation", "finance-gate", "identity", "maintenance")
Assert-OnlyDirectories "packages" @("surface-view-models")

Assert-NoFile (Join-Parts @(".github/workflows/", "v", "5", "_", "4", "_control_plane.yml"))
Assert-NoFile (Join-Parts @("docs/", "rules"))
Assert-NoFile (Join-Parts @("docs/", "v", "5", ".", "4"))
Assert-NoFile (Join-Parts @("docs/", "v", "5", ".", "5"))
Assert-NoFile (Join-Parts @("scripts/", "v", "5", "_", "4"))
Assert-NoFile (Join-Parts @("scripts/", "o", "a", "m", "-acf"))

Invoke-Checked "node" @("scripts/oma/check-current-oma.mjs")
Invoke-Checked "node" @("scripts/check-rule-authority.mjs")
Invoke-Checked "node" @("scripts/check-api-boundaries.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-api-boundaries.mjs")
Invoke-Checked "node" @("scripts/check-runtime-write-paths.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-runtime-write-paths.mjs")
Invoke-Checked "node" @("scripts/check-admission-kernel.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-admission-kernel.mjs")
Invoke-Checked "node" @("scripts/check-account-actor-kernel.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-account-actor-kernel.mjs")
Invoke-Checked "node" @("scripts/check-language-kernel.mjs")
Invoke-Checked "node" @("scripts/check-search-kernel.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-search-kernel.mjs")
Invoke-Checked "node" @("scripts/check-policy-as-code.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-policy-as-code.mjs")
Invoke-Checked "node" @("scripts/check-experience-contract.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-experience-contract.mjs")
Invoke-Checked "node" @("scripts/check-surface-contract.mjs", "--self-test")
Invoke-Checked "node" @("scripts/check-surface-contract.mjs")

$ci = Get-Content ".github/workflows/ci.yml" -Raw
foreach ($required in @(
  "scripts/oma/check-current-oma.mjs",
  "scripts/validate-contracts.mjs",
  "scripts/check-api-boundaries.mjs",
  "scripts/check-runtime-write-paths.mjs",
  "scripts/check-admission-kernel.mjs",
  "scripts/check-account-actor-kernel.mjs",
  "scripts/check-language-kernel.mjs",
  "scripts/check-search-kernel.mjs",
  "scripts/check-policy-as-code.mjs",
  "npm --prefix apps/mobile run test",
  "dotnet build WorkOSNext.sln -c Release",
  "WorkOS.RuntimeIntegrationTests",
  "WorkOS.DatabaseSecurityTests",
  "WorkOS.RuntimeContractTests"
)) {
  if ($ci -notmatch [regex]::Escape($required)) {
    Fail "CI must run current OMA check or verification: $required"
  }
}

Write-Host "OMA architecture guard: PASS"
exit 0
