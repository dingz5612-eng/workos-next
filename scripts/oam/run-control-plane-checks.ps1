$ErrorActionPreference = "Stop"

function Invoke-Gate {
  param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Command,
    [Parameter(ValueFromRemainingArguments = $true, Position = 1)]
    [string[]] $Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Gate failed: $Command $($Arguments -join ' ')"
  }
}

Invoke-Gate node scripts/oam/check-current-oam.mjs
Invoke-Gate node scripts/oam/check-p0-rule-ledger.mjs --self-test
Invoke-Gate node scripts/oam/check-p0-rule-ledger.mjs
Invoke-Gate node scripts/oam/check-current-authority-index.mjs
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
Invoke-Gate node scripts/business/check-scenario-field-contract.mjs
Invoke-Gate node scripts/business/check-canonical-scenario-map.mjs
Invoke-Gate node scripts/business/check-evidence-coverage-contract.mjs
Invoke-Gate node scripts/business/check-ledger-posting-contract.mjs
if (-not (Test-Path "artifacts/oam/test-results/mobile/coverage/coverage-summary.json")) {
  Invoke-Gate npm --prefix apps/mobile run test:coverage
}
Invoke-Gate node scripts/oam/generate-mobile-branch-risk-ledger.mjs
Invoke-Gate node scripts/oam/check-mobile-coverage-policy.mjs
Invoke-Gate node scripts/oam/check-mobile-critical-branch-scenarios.mjs
Invoke-Gate node scripts/oam/generate-current-evidence-root.mjs
Invoke-Gate node scripts/oam/check-current-evidence-root.mjs
