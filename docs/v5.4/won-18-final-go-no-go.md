# WON-18 Final Go/No-Go Report

Generated: 2026-05-30
Evaluated fix commit: `465af06`
Status: `NO-GO`
Second batch Mobile/Resource/Stay: `NOT ALLOWED`

## Decision

WON-18 is not allowed to enter the second batch because the required remote gates have not been verified green on the gate-green fix branch.

The three known blockers were addressed locally:

- Bank import `counterparty` is read through `RuntimeFieldAliases`.
- Generated runtime API paths include reconciliation routes such as `/api/reconciliation/bank-statement-imports/preview`.
- `scripts/guard-architecture.ps1` now discovers Minimal API routes declared in endpoint extension files, so `/api/operations/cases` is validated as a real route rather than hidden by an exception.

The MR-00, MR-01, and MR-02 evidence packages exist and are machine generated. Local fresh-DB evidence for API boundary v2, schema verify, invariant runner, and semantic shadow compare passed. Remote CI still needs a PR or authorized workflow dispatch for the fix branch before this report can move to GO.

## Remote CI Evidence

| Workflow | Run id | Status | Failing step | Failure summary |
| --- | ---: | --- | --- | --- |
| CI | `26675613811` | `failure` | `Test mobile` | Previous `main` run failed because generated runtime API paths did not contain `/api/reconciliation/bank-statement-imports/preview`. Local fix branch mobile tests now pass. |
| V5.4 Control Plane Guards | `26675613802` | `failure` | `architecture-guard` | Previous `main` run failed on direct `counterparty` label literal usage. Local fix branch architecture guard now passes against a fresh Postgres test DB. |

Remote fix-branch Actions status: `not verified`.

Attempted PR creation for `codex/won-18-final-go-no-go` failed with GitHub API `403 Resource not accessible by integration`, so CI and V5.4 Control Plane Guards could not be triggered from this environment.

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
| ShadowCompareRunner | `yellow` | Semantic mode; red count 0; yellow count 2 on the reused fresh DB after runtime validation wrote audit data. This is not a Red ShadowCompareReport blocker. |
| Operations API route tests | `passed` | Focused unit tests included route registration and Operations API contract coverage; 11/11 passed. |
| Old API compatibility tests | `passed` | Focused unit tests confirmed old prepare/confirm compatibility wrapper behavior; included in the same 11/11 run. |
| Mobile tests | `passed locally` | `npm --prefix apps/mobile run test`: 9 files, 55 tests passed. |
| Architecture guard | `passed locally` | `scripts/guard-architecture.ps1` passed with `WORKOS_TEST_CONNECTION` and `ConnectionStrings__WorkOSRuntime` pointed at a fresh local Postgres test DB. |

## Go Conditions

| # | Condition | Result | Evidence |
| ---: | --- | --- | --- |
| 1 | CI green | `FAIL` | Previous GitHub Actions CI run `26675613811` concluded `failure`; fix branch has not yet been verified by Actions. |
| 2 | V5.4 Control Plane Guards green | `FAIL` | Previous GitHub Actions run `26675613802` concluded `failure`; fix branch has not yet been verified by Actions. |
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
| 13 | No Red ShadowCompareReport | `PASS` | Semantic ShadowCompareRunner result has red count 0. |

## Blockers

P0 blockers:

- CI is not yet green on the gate-green fix branch. The previous `main` run `26675613811` is red, and this environment could not create the PR needed to trigger a new PR run.
- V5.4 Control Plane Guards is not yet green on the gate-green fix branch. The previous `main` run `26675613802` is red, and this environment could not create the PR needed to trigger a new PR run.

## Local Validation Commands

| Command | Result |
| --- | --- |
| `npm --prefix apps/mobile run test` | `PASS`, 55/55 tests |
| `node scripts/check-api-boundaries.mjs --self-test` | `PASS` |
| `node scripts/check-api-boundaries.mjs` | `PASS` |
| `node scripts/v5_4/control-plane-schema-verify.mjs --out=.tmp/v5_4/won-18-gate-green-control-plane-schema-verify.json` | `PASS` |
| `node scripts/v5_4/invariant-runner.mjs --releaseId=won-18-final --mrId=WON-18 --ciRunId=local-won-18-gate-green --out=.tmp/v5_4/won-18-gate-green-invariant-checks.json` | `PASS` |
| `node scripts/v5_4/shadow-compare-runner.mjs --mode=semantic --releaseId=won-18-final --mrId=WON-18 --ciRunId=local-won-18-gate-green --out=.tmp/v5_4/won-18-gate-green-shadow-compare-report.json` | `PASS`, grade `yellow`, red count 0 |
| `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release --filter "<operations and old API focused tests>"` | `PASS`, 11/11 tests |
| `pwsh -NoProfile -File scripts/guard-architecture.ps1` | `PASS` with a fresh local Postgres test DB |

## Final Ruling

`status = NO-GO`

WON-18 cannot proceed to the second batch Mobile/Resource/Stay until CI and V5.4 Control Plane Guards are green on GitHub Actions for the gate-green fix branch.
