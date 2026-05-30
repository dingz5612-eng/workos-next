# WON-18 CI and V5.4 Control Plane Guards Triage

Date: 2026-05-30

## Commit

- Branch: `main`
- Commit SHA: `1f287882161a597df74dc24f3c87765562ff1847`
- Commit subject: `WON-17 add v5.4 release control plane gates`

## Red Status Summary

| Workflow/check | Why it is red | Failure bucket | Not the cause |
| --- | --- | --- | --- |
| `CI` | Mobile tests fail because generated `runtimeApiPaths.js` does not include reconciliation and correction-center endpoints that `apiClient.js` and `financeReconciliationView.test.js` expect. | Test failure | Not a .NET build failure, not a mobile build failure, not API boundary failure, not migration failure. |
| `V5.4 Control Plane Guards` | `architecture-guard` fails before the V5.4 guard chain reaches API boundary, migration, invariant, shadow compare, gate runner, or release manifest validation. The guard flags direct payload key access in `BankStatementImportService.cs`. | Architecture guard failure | Not a backend build failure, not a control-plane migration failure, not gate validation failure, not release manifest validation failure in GitHub Actions, and not business signoff absence. |
| Requested local manifest command | The requested local command generated gate id `gate-v5-4-local-triage`, but the fixture manifest expects `gate-v5-4-skeleton-not-run`. | Local release manifest validation mismatch | This is not the GitHub Actions V5.4 red step; the workflow uses the fixture id and would pass this specific validation once reached. |

Business signoff note:

- The skeleton `gate-runner` output records missing `business_signoff_refs` as a P2 `not_run` no-go item.
- That is not the reason the current GitHub `V5.4 Control Plane Guards` workflow is red, because the workflow stops earlier at `architecture-guard`.

## Local Reproduction

| Command | Result | Notes |
| --- | --- | --- |
| `dotnet build WorkOSNext.sln -c Release` | PASS | 110 MSTEST analyzer warnings, 0 errors. |
| `npm --prefix apps/mobile ci` | PASS after retry | First local attempt failed with Windows `EPERM unlink ... rolldown-binding.win32-x64-msvc.node` because a local Vite/node process held `node_modules`; after stopping it, `npm ci` passed. This is local environment noise, not a CI root cause. |
| `npm --prefix apps/mobile run build` | PASS | Vite production build succeeded. |
| `npm --prefix apps/mobile run test` | FAIL | 1 failed, 54 passed. `financeReconciliationView.test.js` expected generated reconciliation API paths that are missing from `apps/mobile/src/generated/runtimeApiPaths.js`. |
| `node scripts/check-api-boundaries.mjs --self-test` | PASS | API boundary self-test passed. |
| `node scripts/check-api-boundaries.mjs` | PASS | API boundary check passed. |
| `node scripts/v5_4/control-plane-migration.mjs` | PASS | Control plane migration check passed. |
| `node scripts/v5_4/shadow-namespace-isolation.mjs` | PASS | Shadow namespace isolation check passed. |
| `node scripts/v5_4/invariant-runner.mjs --mode=skeleton --out=.tmp/v5_4/invariant-check.not_run.json` | PASS | Wrote 22 skeleton invariants. |
| `node scripts/v5_4/shadow-compare-runner.mjs --mode=skeleton --out=.tmp/v5_4/shadow-compare-report.not_run.json` | PASS | Wrote green skeleton shadow report. |
| `node scripts/v5_4/gate-runner.mjs --mode=skeleton --id=gate-v5-4-local-triage --invariant=.tmp/v5_4/invariant-check.not_run.json --shadow=.tmp/v5_4/shadow-compare-report.not_run.json --out=.tmp/v5_4/gate-result.local.json` | PASS | Wrote status `not_run`. |
| `node scripts/v5_4/release-manifest-validate.mjs --manifest=docs/v5.4/release-manifest.fixture.json --gate=.tmp/v5_4/gate-result.local.json` | FAIL | Fixture expects `gate-v5-4-skeleton-not-run`; generated local triage gate id is `gate-v5-4-local-triage`. |

Additional local reproduction for the GitHub V5.4 failure:

| Command | Result | Notes |
| --- | --- | --- |
| `./scripts/guard-architecture.ps1` | FAIL | Reports `services/core-api/WorkOS.Api/Runtime/BankStatementImportService.cs:84` and fails with `Runtime policy and storage must read canonical field ids through RuntimeFieldAliases, not label literals.` |

Control check:

- When `gate-runner` uses the workflow id `gate-v5-4-skeleton-not-run`, `release-manifest-validate` passes against `docs/v5.4/release-manifest.fixture.json`.
- Therefore the requested local `release-manifest-validate` failure is an id mismatch in the triage command, not the current GitHub Actions V5.4 failure step.

## GitHub Actions Failure Steps

Latest `main` runs for this SHA:

| Workflow | Run | Failed job | Failed step | Evidence |
| --- | --- | --- | --- | --- |
| `CI` | `26675613811` | `build-and-test` | `Test mobile` | `npm --prefix apps/mobile run test` fails in `src/__tests__/financeReconciliationView.test.js`, assertion expects `/api/reconciliation/bank-statement-imports/preview` in generated paths. |
| `V5.4 Control Plane Guards` | `26675613802` | `v5-4-control-plane` | `architecture-guard` | `./scripts/guard-architecture.ps1` fails on `services/core-api/WorkOS.Api/Runtime/BankStatementImportService.cs:84`, direct `rawPayload.TryGetValue("counterparty", ...)`. |

## Failure Classification

| Severity | Failure | Classification | Root cause |
| --- | --- | --- | --- |
| P0 | V5.4 `architecture-guard` failure | Contract/architecture guard violation | `BankStatementImportService.cs` reads a payload key literal directly instead of going through `RuntimeFieldAliases`, violating the canonical field id rule. This blocks the V5.4 guard workflow before later V5.4 steps can run. |
| P1 | CI mobile test failure | Generated contract/API path drift | `apiClient.js` and finance reconciliation tests expect generated runtime paths for bank import, match candidates, mismatches, and correction center endpoints. `apps/mobile/src/generated/runtimeApiPaths.js` does not contain these paths, and the OpenAPI/generator descriptor set is behind runtime API usage. |
| P2 | Requested local `release-manifest-validate` failure | Local triage command fixture mismatch | The manifest fixture pins `gate_result_id` to `gate-v5-4-skeleton-not-run`, while the requested command generated `gate-v5-4-local-triage`. Workflow uses the fixture id and validation passes if run with that id. |
| P2 | First local `npm ci` failure | Local Windows process lock | A running Vite/node process held the Rolldown native binding under `node_modules`, causing `EPERM unlink`. CI did not show this failure; retry after stopping local node processes passed. |

## Suggested Fix PR

Recommended PR: `WON-18 fix CI generated paths and V5.4 architecture guard`.

Scope:

- Update `docs/contracts/workos-runtime.openapi.json` and `scripts/generate-contract-dtos.mjs` so generated `runtimeApiPaths.js` includes the reconciliation bank statement import, reconciliation match/mismatch, and correction center endpoints used by `apps/mobile/src/apiClient.js`.
- Regenerate and commit `apps/mobile/src/generated/runtimeApiPaths.js` and any matching generated contract output.
- Fix `services/core-api/WorkOS.Api/Runtime/BankStatementImportService.cs` so payload reads use canonical field id handling through `RuntimeFieldAliases` instead of direct label/key literals.
- Add or keep a focused guard/test assertion so the generated path drift and canonical payload access do not regress.
- Do not modify workflow files to fake a pass.

Suggested validation for that PR:

```bash
dotnet build WorkOSNext.sln -c Release
npm --prefix apps/mobile ci
npm --prefix apps/mobile run build
npm --prefix apps/mobile run test
./scripts/guard-architecture.ps1
node scripts/check-api-boundaries.mjs --self-test
node scripts/check-api-boundaries.mjs
node scripts/v5_4/control-plane-migration.mjs
node scripts/v5_4/shadow-namespace-isolation.mjs
node scripts/v5_4/invariant-runner.mjs --mode=skeleton --out=.tmp/v5_4/invariant-check.not_run.json
node scripts/v5_4/shadow-compare-runner.mjs --mode=skeleton --out=.tmp/v5_4/shadow-compare-report.not_run.json
node scripts/v5_4/gate-runner.mjs --mode=skeleton --id=gate-v5-4-skeleton-not-run --invariant=.tmp/v5_4/invariant-check.not_run.json --shadow=.tmp/v5_4/shadow-compare-report.not_run.json --out=.tmp/v5_4/gate-result.not_run.json
node scripts/v5_4/release-manifest-validate.mjs --manifest=docs/v5.4/release-manifest.fixture.json --gate=.tmp/v5_4/gate-result.not_run.json
```

## B/C Batch Decision

Do not allow entry into B/C batch yet.

Reason:

- P0 V5.4 architecture guard is red.
- P1 mobile generated API contract test is red.
- Later V5.4 steps in GitHub Actions are skipped because `architecture-guard` fails first, so the full guard chain has not completed on `main`.
