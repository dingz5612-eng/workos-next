# Testing and CI Rules

V5.5 invariants use a maturity model so release evidence is not reduced to
named skeleton checks.

## Maturity Levels

- L0 declared: documented only.
- L1 skeleton: runner recognizes the invariant but does not verify business
  state.
- L2 sql_or_service: automated SQL, file, or service check verifies state.
- L3 acceptance_linked: acceptance or contract test links to the invariant.
- L4 release_blocking: P0/P1 gate blocks release when failing.

## Rules

- P0 invariants cannot stay at L1 without `targetMaturity`, `deadlineMr`, and
  `blockerPolicy`.
- MR active or locked work must list its related invariants in an MR contract.
- CI must run invariant maturity checks before a final V5.5 Go/No-Go report can
  mark the next business batch as allowed.
- `docs/rules/v5.5/invariant-maturity.yml` is the machine source.
