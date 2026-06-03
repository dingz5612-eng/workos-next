# OAM-ACF Phase 0 Baseline And Boundary

## Authority Read

OAM-ACF work starts from the following authority chain:

1. `docs/engineering/00-rule-authority.md`
2. `docs/rules/v5.5/rule-authority.yml`
3. `docs/acceptance/13-v5.5-rules-os-go-no-go.md`
4. `docs/rules/v5.5/api-boundary.yml`
5. `docs/rules/v5.5/fact-ownership.yml`
6. `docs/rules/v5.5/fact-write-map.yml`
7. `artifacts/release-state/current-state.json`
8. `artifacts/release-state/post-merge-attestation.json`

`docs/engineering` and `docs/rules/v5.5` define the highest engineering rule
authority. `artifacts/release-state/current-state.json` is the state decision
authority for the current release posture.

## Phase 0 Boundary

Phase 0 only freezes the current remote authoritative baseline and repairs stale
attestation binding when the repository head, current-state, post-merge
attestation, artifact git binding, or CI head SHA diverge.

Allowed writes:

- OAM-ACF docs, schemas, scripts, and generated baseline artifacts.
- Release-state attestation artifacts needed to rebind stale evidence to the
  current `origin/main`.

Forbidden writes:

- Business logic.
- API routes or API behavior.
- Database schema.
- Frontend interaction behavior.

## Frozen State Semantics

The generated `artifacts/oam-acf/phase-0/oam-acf-baseline.json` records the
current repository, branch, actual remote head, current-state head, PR #78 and
PR #79 merge SHAs, and release-state posture.

It must not declare that Day-2 has begun, Dormitory L2 is ready, or Business
Production is open. Dormitory remains L1 internal pilot observation; Dormitory
L2 and Business Production remain blocked; Repair, Parts, and HR remain L0
contract preview.
