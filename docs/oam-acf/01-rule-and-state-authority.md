# Rule And State Authority

The repository authority order for OAM-ACF work is:

1. `docs/engineering/00-rule-authority.md`
2. `docs/rules/v5.5/rule-authority.yml`
3. `docs/acceptance/13-v5.5-rules-os-go-no-go.md`
4. `docs/rules/v5.5/api-boundary.yml`
5. `docs/rules/v5.5/fact-ownership.yml`
6. `docs/rules/v5.5/fact-write-map.yml`
7. `artifacts/release-state/current-state.json`
8. `artifacts/release-state/post-merge-attestation.json`

`docs/architecture/*` is compatibility and historical reference. It may explain
how the current runtime was assembled, but it cannot override V5.5 Rule
Authority, API-boundary classification, fact ownership, MR contracts, release
gates, or current-state.

Current-state is the state decision authority. It currently keeps Dormitory in
L1 internal pilot observation, keeps Dormitory L2 and Business Production
blocked, and keeps Repair, Parts, and HR at L0 contract preview.

When `main`, current-state, post-merge attestation, artifact git binding, or CI
head SHA diverge, Phase 1 and later work must stop until Phase 0
self-stabilizing attestation repair has rebound the evidence to current
`origin/main`.
