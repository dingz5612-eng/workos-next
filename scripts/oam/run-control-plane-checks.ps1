$ErrorActionPreference = "Stop"
$script:GateResults = @()
$script:GateReportPath = "artifacts/oam/checks/control-plane-gate-results.json"

function Get-GitValue {
  param([string[]] $Arguments)

  try {
    $value = & git @Arguments
    if ($LASTEXITCODE -eq 0) {
      return (($value -join "`n").Trim())
    }
  } catch {
    return "unknown"
  }
  return "unknown"
}

function Write-GateReport {
  param([string] $Status = "running")

  $failed = @($script:GateResults | Where-Object { $_.status -ne "passed" })
  $effectiveStatus = if ($failed.Count -eq 0 -and $Status -ne "failed") { "passed" } else { "failed" }
  $report = [ordered]@{
    version = "oam.control-plane-gate-results.v1"
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = Get-GitValue -Arguments @("rev-parse", "HEAD")
    branch = Get-GitValue -Arguments @("branch", "--show-current")
    status = $effectiveStatus
    requiredGateCount = $script:GateResults.Count
    failedGateCount = $failed.Count
    gates = $script:GateResults
  }

  $dir = Split-Path -Parent $script:GateReportPath
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $report | ConvertTo-Json -Depth 8 | Set-Content -Path $script:GateReportPath -Encoding UTF8
}

function Invoke-Gate {
  param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Command,
    [Parameter(ValueFromRemainingArguments = $true, Position = 1)]
    [string[]] $Arguments,
    [bool] $RecordResult = $true
  )

  $commandLine = "$Command $($Arguments -join ' ')".Trim()
  $startedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  try {
    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      throw "Gate failed with exit code ${exitCode}: $commandLine"
    }
    if ($RecordResult) {
      $script:GateResults += [ordered]@{
        command = $commandLine
        status = "passed"
        exitCode = 0
        startedAtUtc = $startedAtUtc
        endedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
      }
      Write-GateReport
    }
  } catch {
    if ($RecordResult) {
      $script:GateResults += [ordered]@{
        command = $commandLine
        status = "failed"
        exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 1 }
        startedAtUtc = $startedAtUtc
        endedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        message = $_.Exception.Message
      }
      Write-GateReport -Status "failed"
    }
    throw
  }
}

Invoke-Gate node scripts/oam/check-current-oam.mjs
Invoke-Gate node scripts/oam/check-p0-rule-ledger.mjs --self-test
Invoke-Gate node scripts/oam/check-p0-rule-ledger.mjs
Invoke-Gate node scripts/oam/check-current-authority-index.mjs
Invoke-Gate node scripts/oam/check-system-operating-kernel.mjs
Invoke-Gate node scripts/business/generate-dormitory-derived-contracts.mjs
Invoke-Gate node scripts/oam/check-oam-kernel-graph.mjs
Invoke-Gate node scripts/oam/generate-current-engineering-ledger.mjs
Invoke-Gate node scripts/oam/check-file-lifecycle-policy.mjs
Invoke-Gate node scripts/oam/check-retired-reference-blocker.mjs
Invoke-Gate node scripts/oam/generate-system-derived-contracts.mjs
Invoke-Gate node scripts/oam/check-derived-contract-consistency.mjs
Invoke-Gate node scripts/oam/check-system-handoff-contract.mjs
Invoke-Gate node scripts/oam/check-system-failure-routing-contract.mjs
Invoke-Gate node scripts/oam/check-current-engineering-ledger.mjs
Invoke-Gate node scripts/oam/check-oam-responsibility-boundary-matrix.mjs
Invoke-Gate node scripts/oam/check-business-object-field-registry.mjs
Invoke-Gate node scripts/oam/check-workflow-state-registry.mjs
Invoke-Gate node scripts/oam/check-db-ownership-map.mjs
Invoke-Gate node scripts/oam/check-evidence-contract-refs.mjs
Invoke-Gate node scripts/oam/check-runtime-governance-v2.mjs
Invoke-Gate node scripts/validate-contracts.mjs
Invoke-Gate node scripts/check-rule-authority.mjs
Invoke-Gate node scripts/check-local-path-references.mjs --self-test
Invoke-Gate node scripts/check-local-path-references.mjs
Invoke-Gate node scripts/check-api-boundaries.mjs --self-test
Invoke-Gate node scripts/check-api-boundaries.mjs
Invoke-Gate node scripts/oam/check-operation-identity-boundary.mjs
Invoke-Gate node scripts/check-runtime-write-paths.mjs --self-test
Invoke-Gate node scripts/check-runtime-write-paths.mjs
Invoke-Gate node scripts/check-admission-kernel.mjs --self-test
Invoke-Gate node scripts/check-admission-kernel.mjs
Invoke-Gate node scripts/check-business-line-admission.mjs
Invoke-Gate node scripts/check-account-actor-kernel.mjs --self-test
Invoke-Gate node scripts/check-account-actor-kernel.mjs
Invoke-Gate node scripts/check-language-kernel.mjs
Invoke-Gate node scripts/oam/check-surface-language-v2.mjs
Invoke-Gate node scripts/check-search-kernel.mjs --self-test
Invoke-Gate node scripts/check-search-kernel.mjs
Invoke-Gate node scripts/check-surface-contract.mjs
Invoke-Gate node scripts/check-experience-contract.mjs
Invoke-Gate node scripts/trust/check-trust-boundary-kernel.mjs
Invoke-Gate node scripts/check-policy-as-code.mjs --self-test
Invoke-Gate node scripts/check-policy-as-code.mjs
Invoke-Gate node scripts/check-domain-packs.mjs --self-test
Invoke-Gate node scripts/check-domain-packs.mjs
Invoke-Gate node scripts/check-truth-owners.mjs --self-test
Invoke-Gate node scripts/check-truth-owners.mjs
Invoke-Gate node scripts/check-finance-truth.mjs --self-test
Invoke-Gate node scripts/check-finance-truth.mjs
Invoke-Gate node scripts/check-ledger-semantic-rules.mjs
Invoke-Gate node scripts/finance/check-finance-semantic-truth.mjs
Invoke-Gate node scripts/check-management-cockpit-boundary.mjs --self-test
Invoke-Gate node scripts/check-management-cockpit-boundary.mjs
Invoke-Gate node scripts/check-shared-governance-boundary.mjs --self-test
Invoke-Gate node scripts/check-shared-governance-boundary.mjs
Invoke-Gate node scripts/check-dormitory-golden-domain.mjs --self-test
Invoke-Gate node scripts/check-dormitory-golden-domain.mjs
Invoke-Gate node scripts/business/check-dormitory-operating-kernel.mjs
Invoke-Gate node scripts/business/check-dormitory-derived-contracts.mjs
Invoke-Gate node scripts/business/check-dormitory-release-train.mjs
Invoke-Gate node scripts/business/check-dormitory-pilot-scenario-pack.mjs
Invoke-Gate node scripts/business/check-dormitory-metrics-lens-contract.mjs
Invoke-Gate node scripts/business/check-dormitory-execution-kernel.mjs
Invoke-Gate node scripts/business/check-scenario-field-contract.mjs
Invoke-Gate node scripts/business/check-canonical-scenario-map.mjs
Invoke-Gate node scripts/business/check-evidence-coverage-contract.mjs
Invoke-Gate node scripts/business/check-ledger-posting-contract.mjs
Invoke-Gate pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1
Invoke-Gate node scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs
Invoke-Gate node scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs
if (-not (Test-Path "artifacts/oam/test-results/mobile/coverage/coverage-summary.json")) {
  Invoke-Gate npm --prefix apps/mobile run test:coverage
}
Invoke-Gate node scripts/oam/generate-mobile-branch-risk-ledger.mjs
Invoke-Gate node scripts/oam/check-mobile-coverage-policy.mjs
Invoke-Gate node scripts/oam/check-mobile-critical-branch-scenarios.mjs
Invoke-Gate node scripts/oam/generate-current-evidence-root.mjs -RecordResult $false
Invoke-Gate node scripts/oam/check-current-evidence-root.mjs -RecordResult $false
