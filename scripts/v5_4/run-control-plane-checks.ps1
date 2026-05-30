$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $repoRoot
New-Item -ItemType Directory -Force -Path ".tmp/v5_4" | Out-Null

Write-Host "architecture-guard"
pwsh -NoProfile -ExecutionPolicy Bypass -File "scripts/guard-architecture.ps1"

Write-Host "api-boundary-check"
node scripts/check-api-boundaries.mjs --self-test
node scripts/check-api-boundaries.mjs

Write-Host "control-plane-migration"
node scripts/v5_4/control-plane-migration.mjs
dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release -p:OutputPath=bin/Release/net10.0/v5_4/ -p:IntermediateOutputPath=obj/v5_4/Release/net10.0/

Write-Host "migration-verification-legacy-freeze"
node scripts/v5_4/migration-verification.mjs --dry-run=false --releaseId=v5.4-migration-verification --mrId=local --out=.tmp/v5_4/migration-verification-invariant-checks.json --report-out=.tmp/v5_4/migration-verification-report.json --backfill-out=.tmp/v5_4/legacy-backfill-report.json

Write-Host "shadow-namespace-isolation"
node scripts/v5_4/shadow-namespace-isolation.mjs

Write-Host "invariant-runner"
node scripts/v5_4/invariant-runner.mjs --mode=skeleton --out=.tmp/v5_4/invariant-check.not_run.json

Write-Host "ledger-inspection-job"
node scripts/v5_4/ledger-inspection.mjs --job-mode=manual --releaseId=v5.4-ledger-inspection --mrId=local --out=.tmp/v5_4/ledger-inspection-invariant-checks.json --report-out=.tmp/v5_4/ledger-inspection-report.json --dashboard-out=.tmp/v5_4/ledger-inspection-dashboard-summary.json

Write-Host "backup-restore-smoke"
node scripts/v5_4/backup-restore-smoke.mjs --dry-run=false --cleanup=true --releaseId=v5.4-backup-restore-smoke --mrId=local --out=.tmp/v5_4/backup-restore-smoke-invariant-checks.json --report-out=.tmp/v5_4/backup-restore-smoke-report.json --restore-invariant-out=.tmp/v5_4/backup-restore-after-restore-invariants.json

Write-Host "shadow-compare-runner"
node scripts/v5_4/shadow-compare-runner.mjs --mode=skeleton --out=.tmp/v5_4/shadow-compare-report.not_run.json

Write-Host "gate-runner"
node scripts/v5_4/gate-runner.mjs --mode=skeleton --id=gate-v5-4-skeleton-not-run --invariant=.tmp/v5_4/invariant-check.not_run.json --shadow=.tmp/v5_4/shadow-compare-report.not_run.json --out=.tmp/v5_4/gate-result.not_run.json

Write-Host "release-manifest-validate"
node scripts/v5_4/release-manifest-validate.mjs --manifest=docs/v5.4/release-manifest.fixture.json --gate=.tmp/v5_4/gate-result.not_run.json

Write-Host "V5.4 control plane checks: PASS"
