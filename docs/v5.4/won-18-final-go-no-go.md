# WON-18 Final Go/No-Go Report

Generated: 2026-05-30
Commit SHA: `1f287882161a597df74dc24f3c87765562ff1847`
Status: `NO-GO`
Second batch Mobile/Resource/Stay: `NOT ALLOWED`

## Decision

WON-18 is not allowed to enter the second batch because the required remote gates are not green.

The MR-00, MR-01, and MR-02 evidence packages exist and are machine generated. Local fresh-DB evidence for API boundary v2, schema verify, invariant runner, and semantic shadow compare passed. However, the current GitHub Actions runs for this commit are still red, and the local architecture guard still reports an OpenAPI/Minimal API mismatch.

## Remote CI Evidence

| Workflow | Run id | Status | Failing step | Failure summary |
| --- | ---: | --- | --- | --- |
| CI | `26675613811` | `failure` | `Test mobile` | Vitest failed in `src/__tests__/financeReconciliationView.test.js`; generated runtime API paths did not contain `/api/reconciliation/bank-statement-imports/preview`. |
| V5.4 Control Plane Guards | `26675613802` | `failure` | `architecture-guard` | Guard found `services/core-api/WorkOS.Api/Runtime/BankStatementImportService.cs:84` using the label literal `counterparty`; runtime policy/storage must read canonical field ids through `RuntimeFieldAliases`. |

Run URLs:

- CI: https://github.com/dingz5612-eng/workos-next/actions/runs/26675613811
- V5.4 Control Plane Guards: https://github.com/dingz5612-eng/workos-next/actions/runs/26675613802

## Local Evidence Summary

Fresh local DB used for WON-18 final runner evidence: recorded in `.tmp/v5_4/won-18-final-db-name.txt`.

| Evidence | Result | Details |
| --- | --- | --- |
| MR-00 GateResult | `passed` | `docs/v5.4/mr-00-gate-result.json`; `generated_by=gate-runner`; `gate_type=automated`; hashes present. |
| MR-01 GateResult | `passed` | `docs/v5.4/mr-01-gate-result.json`; `generated_by=gate-runner`; `gate_type=automated`; hashes present. |
| MR-02 GateResult | `passed` | `docs/v5.4/mr-02-gate-result.json`; `generated_by=gate-runner`; `gate_type=automated`; hashes present. |
| API boundary v2 | `passed` | Version 2; 29 write routes; 29 classified; 0 unclassified; 0 violations. |
| Control Plane schema verify | `passed` | 7 `control_plane` tables and 5 `shadow_runtime` tables exist; constraint probes passed. |
| InvariantRunner | `passed` | 24 checks; 0 failed; 0 P0 blocking failures. |
| ShadowCompareRunner | `green` | Semantic mode; red count 0; yellow count 0. |
| Operations API route tests | `passed` | Focused unit tests included route registration and Operations API contract coverage; 11/11 passed. |
| Old API compatibility tests | `passed` | Focused unit tests confirmed old prepare/confirm compatibility wrapper behavior; included in the same 11/11 run. |
| Mobile tests | `passed locally` | `npm --prefix apps/mobile run test`: 9 files, 55 tests passed. |
| Architecture guard | `failed locally` | `scripts/guard-architecture.ps1` reports `OpenAPI path has no matching Minimal API endpoint: /api/operations/cases`. |

## Go Conditions

| # | Condition | Result | Evidence |
| ---: | --- | --- | --- |
| 1 | CI green | `FAIL` | GitHub Actions CI run `26675613811` concluded `failure`. |
| 2 | V5.4 Control Plane Guards green | `FAIL` | GitHub Actions run `26675613802` concluded `failure`; local architecture guard also fails. |
| 3 | Control Plane 7 objects exist in DB | `PASS` | Schema verify found 7 `control_plane` tables. |
| 4 | `shadow_runtime` exists and official projector does not consume it | `PASS` | Schema verify found 5 `shadow_runtime` tables; semantic shadow contamination check was green. |
| 5 | Operations API endpoints exist | `PASS` | Operations route focused tests passed. |
| 6 | Old Workspace/Card API routes to `OperationsRuntimeService` or is compatibility wrapped | `PASS` | Old API compatibility focused tests passed. |
| 7 | API boundary v2 classifies all non-GET `/api` routes | `PASS` | API boundary v2 classified 29/29 write routes. |
| 8 | No unclassified write routes | `PASS` | API boundary v2 reported 0 unclassified write routes. |
| 9 | MR-00 GateResult exists and is machine-generated | `PASS` | `generated_by=gate-runner`, automated, hashes present. |
| 10 | MR-01 GateResult exists and is machine-generated | `PASS` | `generated_by=gate-runner`, automated, hashes present. |
| 11 | MR-02 GateResult exists and is machine-generated | `PASS` | `generated_by=gate-runner`, automated, hashes present. |
| 12 | No P0 blocking invariant failed | `PASS` | Fresh-DB InvariantRunner result has 0 P0 failures. |
| 13 | No Red ShadowCompareReport | `PASS` | Semantic ShadowCompareRunner result is green with red count 0. |

## Blockers

P0 blockers:

- CI is not green. Current CI run `26675613811` failed at `Test mobile`.
- V5.4 Control Plane Guards is not green. Current run `26675613802` failed at `architecture-guard`.
- Local architecture guard still fails because `/api/operations/cases` is present in OpenAPI but is not matched by the guard's Minimal API endpoint discovery.

## Local Validation Commands

| Command | Result |
| --- | --- |
| `npm --prefix apps/mobile run test` | `PASS`, 55/55 tests |
| `node scripts/check-api-boundaries.mjs --self-test` | `PASS` |
| `node scripts/check-api-boundaries.mjs` | `PASS` |
| `node scripts/v5_4/control-plane-schema-verify.mjs --out=.tmp/v5_4/won-18-final-control-plane-schema-verify.json` | `PASS` |
| `node scripts/v5_4/invariant-runner.mjs --releaseId=won-18-final --mrId=WON-18 --ciRunId=local-won-18-final --out=.tmp/v5_4/won-18-final-invariant-checks.json` | `PASS` |
| `node scripts/v5_4/shadow-compare-runner.mjs --mode=semantic --releaseId=won-18-final --mrId=WON-18 --ciRunId=local-won-18-final --out=.tmp/v5_4/won-18-final-shadow-compare-report.json` | `PASS`, grade `green` |
| `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release --filter "<operations and old API focused tests>"` | `PASS`, 11/11 tests |
| `pwsh -NoProfile -File scripts/guard-architecture.ps1` | `FAIL`, OpenAPI route mismatch |

## Final Ruling

`status = NO-GO`

WON-18 cannot proceed to the second batch Mobile/Resource/Stay until CI and V5.4 Control Plane Guards are green on GitHub Actions and the local architecture guard mismatch is resolved.
