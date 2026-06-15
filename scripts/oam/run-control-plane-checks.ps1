$ErrorActionPreference = "Stop"
$script:GateResults = @()
$script:AdvisoryGateResults = @()
$script:GateReportPath = "artifacts/oam/checks/control-plane-gate-results.json"
$script:RunStartedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
$script:ExpectedGateCount = 0
$script:CurrentStage = "not_started"
$script:CurrentGate = ""
$script:TerminalFailureMessage = ""

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

function Get-ExpectedGateCount {
  $scriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }
  $content = Get-Content -Raw -Path $scriptPath
  $count = [regex]::Matches($content, "(?m)^\s*Invoke-Gate\b(?!.*-RecordResult\s+\`$false)").Count
  if ($env:ALLOW_GENERATED_COMPILE_CANDIDATE -ne "true" -and -not (Test-FormalGeneratedCompileAuthorized)) {
    $count -= 1
  }
  if (Test-Path "artifacts/oam/test-results/mobile/coverage/coverage-summary.json") {
    $count -= 1
  }
  return $count
}

function Test-FormalGeneratedCompileAuthorized {
  try {
    $authorized = & node scripts/oam/formal-generated-compile-authorization-status.mjs --print-authorized
    return (($authorized -join "").Trim() -eq "true")
  } catch {
    return $false
  }
}

function Get-StageForCommand {
  param([string] $CommandLine)

  if ($CommandLine -match "authority|current-architecture|current-oam|rule-authority|truth-ownership|truth-owners|file-lifecycle|source-layer") {
    return "authority_file_lifecycle"
  }
  if ($CommandLine -match "generated|derived|compile|kernel-graph") {
    return "generated_compiler"
  }
  if ($CommandLine -match "runtime|api-boundaries|search|read-intelligence|surface|dashboard|finance|ledger|metric|language") {
    return "runtime_read_surface_finance"
  }
  if ($CommandLine -match "browser|coverage|mobile") {
    return "browser_mobile_evidence"
  }
  if ($CommandLine -match "evidence-root|release-attestation") {
    return "evidence_report"
  }
  return "control_plane_gate"
}

function Write-GateReport {
  param(
    [string] $RunStatus = "running",
    [string] $Status = "running",
    [string] $CurrentStage = $script:CurrentStage,
    [string] $CurrentGate = $script:CurrentGate
  )

  $failed = @($script:GateResults | Where-Object { $_.status -ne "passed" })
  $completedGateCount = $script:GateResults.Count
  $effectiveStatus = if ($RunStatus -eq "completed" -and $failed.Count -eq 0 -and $completedGateCount -eq $script:ExpectedGateCount) {
    "passed"
  } elseif ($RunStatus -eq "failed" -or $Status -eq "failed" -or $failed.Count -gt 0) {
    "failed"
  } elseif ($RunStatus -eq "not_started") {
    "not_started"
  } else {
    "running"
  }
  $finalizable = $RunStatus -eq "completed" -and $effectiveStatus -eq "passed" -and $completedGateCount -eq $script:ExpectedGateCount
  $blockingReasons = @()
  if ($RunStatus -eq "running") {
    $blockingReasons += "Control Plane is still running and cannot be used as final adjudication."
  }
  if ($RunStatus -eq "failed") {
    $blockingReasons += "Control Plane failed and cannot be used as final PASS."
  }
  if ($completedGateCount -ne $script:ExpectedGateCount) {
    $blockingReasons += "Control Plane completed gate count does not match expectedGateCount: completed=${completedGateCount}, expected=$($script:ExpectedGateCount)."
  }
  if ($failed.Count -gt 0) {
    $blockingReasons += "Control Plane failed gate count: $($failed.Count)."
  }
  if ($script:TerminalFailureMessage) {
    $blockingReasons += $script:TerminalFailureMessage
  }
  $report = [ordered]@{
    version = "oam.control-plane-gate-results.v1"
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    commitSha = Get-GitValue -Arguments @("rev-parse", "HEAD")
    branch = Get-GitValue -Arguments @("branch", "--show-current")
    runStatus = $RunStatus
    status = $effectiveStatus
    expectedGateCount = $script:ExpectedGateCount
    requiredGateCount = $script:ExpectedGateCount
    completedGateCount = $completedGateCount
    failedGateCount = $failed.Count
    finalizable = $finalizable
    startedAtUtc = $script:RunStartedAtUtc
    finishedAtUtc = if ($RunStatus -in @("completed", "failed")) { (Get-Date).ToUniversalTime().ToString("o") } else { $null }
    currentStage = $CurrentStage
    currentGate = $CurrentGate
    blockingReasons = $blockingReasons
    gates = $script:GateResults
    advisoryGates = $script:AdvisoryGateResults
  }

  $dir = Split-Path -Parent $script:GateReportPath
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $tempPath = "$($script:GateReportPath).tmp"
  $json = $report | ConvertTo-Json -Depth 8
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path -Parent $tempPath)).Path + [System.IO.Path]::DirectorySeparatorChar + (Split-Path -Leaf $tempPath), $json, $utf8NoBom)
  Move-Item -LiteralPath $tempPath -Destination $script:GateReportPath -Force
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
  $script:CurrentGate = $commandLine
  $script:CurrentStage = Get-StageForCommand -CommandLine $commandLine
  if ($RecordResult) {
    Write-GateReport -RunStatus "running"
  }
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
      Write-GateReport -RunStatus "running"
    }
  } catch {
    $script:TerminalFailureMessage = "Control Plane current gate failed: $commandLine. $($_.Exception.Message)"
    if ($RecordResult) {
      $script:GateResults += [ordered]@{
        command = $commandLine
        status = "failed"
        exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 1 }
        startedAtUtc = $startedAtUtc
        endedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        message = $_.Exception.Message
      }
    }
    Write-GateReport -RunStatus "failed" -Status "failed"
    throw
  }
}

function Invoke-AdvisoryGate {
  param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Command,
    [Parameter(ValueFromRemainingArguments = $true, Position = 1)]
    [string[]] $Arguments
  )

  $commandLine = "$Command $($Arguments -join ' ')".Trim()
  $startedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  $script:CurrentGate = $commandLine
  $script:CurrentStage = Get-StageForCommand -CommandLine $commandLine
  Write-GateReport -RunStatus "running"
  try {
    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      throw "Advisory gate failed with exit code ${exitCode}: $commandLine"
    }
    $script:AdvisoryGateResults += [ordered]@{
      command = $commandLine
      laneMode = "advisory"
      status = "passed"
      exitCode = 0
      startedAtUtc = $startedAtUtc
      endedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    }
  } catch {
    $script:AdvisoryGateResults += [ordered]@{
      command = $commandLine
      laneMode = "advisory"
      status = "advisory_failed"
      exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 1 }
      startedAtUtc = $startedAtUtc
      endedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
      message = $_.Exception.Message
    }
  }
  Write-GateReport -RunStatus "running"
}

$script:ExpectedGateCount = Get-ExpectedGateCount
$script:CurrentStage = "initializing"
$script:CurrentGate = ""
Write-GateReport -RunStatus "running"

Invoke-Gate node scripts/oam/check-current-oam.mjs
Invoke-Gate node scripts/oam/check-current-architecture-manifest.mjs
Invoke-Gate node scripts/oam/check-authority-ledger-append-only.mjs
Invoke-Gate node scripts/oam/check-current-projection-from-ledger.mjs
Invoke-Gate node scripts/oam/check-no-active-legacy-identity.mjs
Invoke-Gate node scripts/oam/check-no-active-path-legacy-identity.mjs
Invoke-Gate node scripts/oam/check-no-current-capability-uses-legacy-seed.mjs
Invoke-Gate node scripts/oam/check-no-stage-number-authority-leak.mjs
Invoke-Gate node scripts/oam/check-no-stage-number-active-authority.mjs
Invoke-Gate node scripts/oam/check-compatibility-box-boundary.mjs
Invoke-Gate node scripts/oam/check-capability-state-machine-transition.mjs
Invoke-Gate node scripts/oam/check-control-plane-lane-boundary.mjs
Invoke-Gate node scripts/oam/check-gate-taxonomy.mjs
Invoke-Gate node scripts/oam/check-p0-rule-ledger.mjs --self-test
Invoke-Gate node scripts/oam/check-p0-rule-ledger.mjs
Invoke-Gate node scripts/oam/check-current-authority-index.mjs
Invoke-Gate node scripts/authority/check-master-design-schema.mjs
Invoke-Gate node scripts/authority/check-truth-ownership-matrix.mjs
Invoke-Gate node scripts/oam/generate-authority-source-layer-audit.mjs
Invoke-Gate node scripts/oam/check-authority-source-layer-audit.mjs
Invoke-Gate node scripts/oam/check-authority-cleanup-mutation-tests.mjs
Invoke-Gate node scripts/oam/check-kernel-responsibility-map.mjs
Invoke-Gate node scripts/oam/check-professional-ai-review-seats.mjs
Invoke-Gate node scripts/oam/check-codex-execution-channel-policy.mjs
Invoke-Gate node scripts/oam/check-cross-domain-conflict-rules.mjs
Invoke-Gate node scripts/oam/check-system-operating-kernel.mjs
Invoke-Gate node scripts/oam/check-generated-compile-authorization.mjs
if ($env:ALLOW_GENERATED_COMPILE_CANDIDATE -eq "true" -or (Test-FormalGeneratedCompileAuthorized)) {
  Invoke-Gate node scripts/business/generate-dormitory-derived-contracts.mjs
}
Invoke-Gate node scripts/oam/compile-current-kernel-graph.mjs
Invoke-Gate node scripts/oam/check-generated-field-binding-closure.mjs
Invoke-Gate node scripts/oam/check-generated-contract-consistency.mjs
Invoke-Gate node scripts/oam/check-generated-files-not-manually-edited.mjs
Invoke-Gate node scripts/oam/check-oam-kernel-graph.mjs
Invoke-Gate node scripts/oam/check-system-change-governance.mjs
Invoke-Gate node scripts/oam/check-iteration-kernel.mjs
Invoke-Gate node scripts/oam/generate-current-engineering-ledger.mjs
Invoke-Gate node scripts/oam/check-file-lifecycle-policy.mjs
Invoke-Gate node scripts/oam/check-retired-reference-blocker.mjs
Invoke-Gate node scripts/oam/generate-system-derived-contracts.mjs
Invoke-Gate node scripts/oam/check-derived-contract-consistency.mjs
Invoke-Gate node scripts/oam/check-generated-compile-execution.mjs
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
Invoke-Gate node scripts/oam/check-read-intelligence-kernel.mjs
Invoke-Gate node scripts/oam/check-bi-kpi-metric-operating-model.mjs
Invoke-Gate node scripts/check-search-kernel.mjs --self-test
Invoke-Gate node scripts/check-search-kernel.mjs
Invoke-Gate node scripts/check-surface-contract.mjs
Invoke-Gate node scripts/check-experience-contract.mjs
Invoke-Gate node scripts/surface/check-surface-experience-contract.mjs
Invoke-Gate node scripts/surface/check-experience-module-productization.mjs
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
Invoke-Gate node scripts/oam/check-dashboard-readonly.mjs --self-test
Invoke-Gate node scripts/oam/check-dashboard-readonly.mjs
Invoke-Gate node scripts/check-management-cockpit-boundary.mjs --self-test
Invoke-Gate node scripts/check-management-cockpit-boundary.mjs
Invoke-Gate node scripts/check-shared-governance-boundary.mjs --self-test
Invoke-Gate node scripts/check-shared-governance-boundary.mjs
Invoke-Gate node scripts/oam/check-db-no-side-effects-proof.mjs
Invoke-Gate node scripts/check-dormitory-golden-domain.mjs --self-test
Invoke-Gate node scripts/check-dormitory-golden-domain.mjs
$previousOamWriteProof = $env:OAM_WRITE_PROOF
$env:OAM_WRITE_PROOF = "1"
Invoke-Gate node scripts/oam/check-dormitory-golden-chain-source-package.mjs
if ($null -eq $previousOamWriteProof) {
  Remove-Item Env:\OAM_WRITE_PROOF -ErrorAction SilentlyContinue
} else {
  $env:OAM_WRITE_PROOF = $previousOamWriteProof
}
Invoke-Gate node scripts/business/check-dormitory-operating-kernel.mjs
$previousOamWriteProof = $env:OAM_WRITE_PROOF
$env:OAM_WRITE_PROOF = "1"
Invoke-Gate node scripts/business/check-dormitory-resource-saleability-golden-chain.mjs
if ($null -eq $previousOamWriteProof) {
  Remove-Item Env:\OAM_WRITE_PROOF -ErrorAction SilentlyContinue
} else {
  $env:OAM_WRITE_PROOF = $previousOamWriteProof
}
Invoke-Gate node scripts/business/check-dormitory-scenario-package-matrix.mjs
Invoke-Gate node scripts/business/check-dormitory-ui-readside-experience.mjs
Invoke-Gate node scripts/business/check-dormitory-period-correction-closure.mjs
Invoke-Gate node scripts/business/check-dormitory-scenario-closure-tests.mjs
Invoke-Gate node scripts/business/check-dormitory-golden-chain-tests.mjs
Invoke-Gate node scripts/business/check-dormitory-derived-contracts.mjs
Invoke-Gate node scripts/business/check-dormitory-release-train.mjs
Invoke-Gate node scripts/business/check-dormitory-pilot-scenario-pack.mjs
Invoke-Gate node scripts/business/check-dormitory-metrics-lens-contract.mjs
$previousOamWriteProof = $env:OAM_WRITE_PROOF
$env:OAM_WRITE_PROOF = "1"
Invoke-Gate node scripts/business/check-dormitory-execution-kernel.mjs
Invoke-Gate node scripts/business/check-scenario-field-contract.mjs
Invoke-Gate node scripts/business/check-canonical-scenario-map.mjs
Invoke-Gate node scripts/business/check-evidence-coverage-contract.mjs
Invoke-Gate node scripts/business/check-ledger-posting-contract.mjs
if ($null -eq $previousOamWriteProof) {
  Remove-Item Env:\OAM_WRITE_PROOF -ErrorAction SilentlyContinue
} else {
  $env:OAM_WRITE_PROOF = $previousOamWriteProof
}
if (-not (Test-Path "artifacts/oam/test-results/mobile/coverage/coverage-summary.json")) {
  Invoke-Gate npm --prefix apps/mobile run test:coverage
}
Invoke-Gate node scripts/oam/generate-mobile-branch-risk-ledger.mjs
Invoke-Gate node scripts/oam/check-mobile-coverage-policy.mjs
Invoke-Gate node scripts/oam/check-mobile-critical-branch-scenarios.mjs
Invoke-Gate node scripts/oam/generate-dormitory-candidate-artifact-attestation-package.mjs
Invoke-Gate node scripts/oam/check-dormitory-candidate-artifact-attestation-package.mjs
Invoke-Gate node scripts/oam/generate-generated-candidate-acceptance.mjs
Invoke-Gate node scripts/oam/check-s5-semantic-digest-idempotency.mjs
Invoke-Gate node scripts/oam/check-generated-candidate-acceptance.mjs --self-test
Invoke-Gate node scripts/oam/check-generated-bundle-content-addressed.mjs
Invoke-Gate node scripts/oam/check-single-capability-bundle-digest.mjs
Invoke-Gate node scripts/oam/check-generated-candidate-acceptance.mjs
Invoke-Gate node scripts/oam/check-runtime-consumes-accepted-bundle.mjs
Invoke-Gate node scripts/oam/check-runtime-consumes-accepted-capability-bundle.mjs
Invoke-Gate node scripts/oam/check-dormitory-runtime-admission.mjs --write-proof
Invoke-Gate node scripts/oam/check-environment-profile-authority.mjs
Invoke-Gate node scripts/oam/check-runtime-stability-lane.mjs
Invoke-Gate node scripts/oam/check-runtime-implementation-drift-policy.mjs
Invoke-Gate node scripts/oam/generate-dormitory-first-golden-chain-test-plan.mjs
Invoke-Gate node scripts/oam/check-test-plan-generated-from-capability.mjs
Invoke-AdvisoryGate pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1
Invoke-Gate node scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs
Invoke-AdvisoryGate node scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs
Invoke-AdvisoryGate node scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs
Invoke-Gate node scripts/oam/check-evidence-is-projection-only.mjs
Invoke-Gate node scripts/oam/check-release-authority-is-only-final-go-source.mjs
Invoke-Gate node scripts/oam/check-evidence-writer-boundary.mjs
Invoke-AdvisoryGate node scripts/oam/check-current-head-authoritative-artifact-reconciliation.mjs
Invoke-AdvisoryGate node scripts/oam/check-dormitory-first-golden-chain-landing.mjs
Invoke-Gate node scripts/oam/generate-current-evidence-root.mjs -RecordResult $false
Invoke-Gate node scripts/oam/check-evidence-digest-chain-single-source.mjs
Write-GateReport -RunStatus "completed" -Status "passed" -CurrentStage "completed" -CurrentGate ""
Invoke-Gate node scripts/oam/generate-current-evidence-root.mjs -RecordResult $false
Invoke-Gate node scripts/oam/check-current-evidence-root.mjs -RecordResult $false
Invoke-Gate node scripts/oam/check-current-oam-release-attestation.mjs -RecordResult $false
