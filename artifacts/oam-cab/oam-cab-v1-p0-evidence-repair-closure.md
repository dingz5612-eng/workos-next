# OAM-CAB v1 P0 Evidence Repair Closure

- status: local evidence repair completed
- PR: #81
- PR state: open
- PR head: `6401149d636b84e5dfc33673e1e3868116fb426a`
- current main: `a259ae2c05e6d3648082e27987075cf295c905bd`
- next_stage.allowed: `false`

## Root Cause

Remote CI run `26934411236` failed at `Validate OAM-00 Evidence Reconciliation`.
The failing PR head still bound OAM-00 evidence to old main `7bbf636041d79b19f2e3121f78f263e391b4931d`, while current `origin/main` is `a259ae2c05e6d3648082e27987075cf295c905bd`.

Clean worktree reproduction produced these P0 freshness failures:

- `oam00.go_no_go_main_sha_stale`
- `oam00.go_no_go_ci_sha_stale`
- `oam00.go_no_go_v54_sha_stale`
- `oam00.graph_head_stale`
- `oam00.dashboard_head_stale`
- `oam00.final_assurance_head_stale`

## Fix

The evidence refs were rebound to current main `a259ae2c05e6d3648082e27987075cf295c905bd`:

- `artifacts/go-live/dormitory/internal-pilot-go-no-go.json`
- `artifacts/rt4/evidence-graph.json`
- `artifacts/rt4/completion-dashboard.json`
- `artifacts/rt4/final-completion-assurance-result.json`
- `artifacts/release-state/evidence-reconciliation-result.json`
- `docs/release-state/evidence-reconciliation-report.md`

The CI workflow now prevents OAM-00 from hiding the rest of the proof chain:

- OAM-00 through OAM-03 run on PR and main push.
- OAM-01 through OAM-09, Architecture guard, Clean baseline, and Diff whitespace use `always()`.

## Local Gate Results

- OAM-00: passed
- OAM-01: passed
- OAM-02: passed
- OAM-03: passed
- OAM-04: passed
- OAM-05: passed
- OAM-06: passed
- OAM-07: `NOT_ELIGIBLE` for L2, as required
- OAM-08: passed
- OAM-09: passed
- Architecture guard: passed
- Clean baseline gate: passed
- Diff whitespace check: passed

## Proof Artifacts

- Runtime Proof: `artifacts/proof/runtime-proof-result.json`
- Correction apply exception: `artifacts/oam-cab/oam-cab-v1-correction-apply-exception-artifact.json`
- Search / Data / BI: `artifacts/oam-cab/oam-cab-v1-search-data-bi-proof-artifact.json`
- Surface / Language: `artifacts/oam-cab/oam-cab-v1-surface-language-proof-artifact.json`
- Evidence Graph: `artifacts/rt4/evidence-graph.json`
- Current State: `artifacts/release-state/current-state.json`
- Post-merge attestation: `artifacts/release-state/post-merge-attestation.json`

## No-Go

This closure does not allow Business Production, Dormitory L2, L0 confirm, or `production_confirm`.
PR #81 remains unmerged, so the repaired PR artifacts are not main-bound evidence until the branch is pushed, PR CI passes, PR #81 is merged, and post-merge main-bound evidence is regenerated.
