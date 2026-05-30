## Summary

-

## Rule Authority

- [ ] I read `docs/engineering/00-rule-authority.md`.
- [ ] I checked `docs/rules/v5.5/rule-authority.yml` for precedence.
- [ ] I checked the V5.5 batch dependency and did not skip a prerequisite rules batch.
- [ ] WON-18 CI and V5.4 Control Plane Guards are green, or this PR only fixes a gate blocker.
- [ ] New design follows the Operations Runtime axis.
- [ ] This PR does not enter Mobile / Resource / Stay / Money / Deposit / Checkout business batches before V5.5 Rules OS Go.

## MR Contract

- MR:
- Slice:
- Runtime Layer:
- Owner:
- Contract file:
- GateResult required:
- Rollback / compensation instruction:

## Fact Ownership

- [ ] Added or changed facts are declared in `docs/rules/v5.5/fact-ownership.yml`.
- [ ] Non-owner writes are not introduced.
- [ ] ProcessManager creates WorkItem or CrossSliceRequest only.
- [ ] Mobile BFF does not write business facts.
- [ ] PC Governance / Reconciliation / Correction does not directly write business facts outside an allowed governance or append-only correction path.

## API Boundary

- [ ] Every non-GET `/api/*` route is classified in `docs/rules/v5.5/api-boundary.yml`.
- [ ] Business writes use Operations Confirm.
- [ ] Compatibility writes are old Workspace/Card wrappers only.
- [ ] No page-specific business write API was added.
- [ ] `node scripts/check-api-boundaries.mjs --self-test`
- [ ] `node scripts/check-api-boundaries.mjs`

## Idempotency

- [ ] CommandSubmission or equivalent submission evidence is recorded.
- [ ] Same tenant + idempotency key + same payload is stable.
- [ ] Same tenant + idempotency key + different payload returns 409.
- [ ] 403 / 409 / 422 have no business side effects.

## Evidence

- [ ] Evidence writes do not confirm Payment / Deposit / Checkout facts.
- [ ] Non-cash confirmation evidence requirements are enforced or declared as blocked.
- [ ] Evidence IDs and files are append-only or reviewed through the evidence owner.

## Ledger

- [ ] LedgerEntry writes are append-only.
- [ ] Old ledger entries are not edited in place.
- [ ] Correction paths use explicit append-only correction service or Operations Confirm.
- [ ] Period snapshots are derived from ledgers, not user-entered finance totals.

## Process / Blocker

- [ ] Blockers are represented as WorkItems or process state.
- [ ] Closed cases have no open blocker.
- [ ] ProcessManager does not directly mutate facts owned by another slice.

## Projection / Lens

- [ ] Official projectors do not consume `shadow_runtime`.
- [ ] Projection / Lens outputs are derived from DomainEvent / LedgerEntry / owner facts.
- [ ] ShadowCompareReport impact is documented if touched.

## Mobile

- [ ] Mobile surface uses runtime APIs and generated paths.
- [ ] No Mobile BFF business fact write was added.
- [ ] No demo fallback supports production behavior.

## PC

- [ ] PC governance write paths require capability, reason, and audit where applicable.
- [ ] Exports are audited and do not write business facts.
- [ ] Reconciliation / Correction remains governance or append-only correction, not page-specific business write.

## Migration / Release

- [ ] Migration is forward-compatible and rollback or compensation is documented.
- [ ] ReleaseManifest / GateResult / RollbackInstruction evidence is updated when needed.
- [ ] GateResult is machine-generated and CI-bound.
- [ ] BusinessSignoff or waiver rules are respected when release state requires them.

## Tests

- [ ] `node scripts/check-rule-authority.mjs`
- [ ] `node scripts/check-fact-ownership.mjs`
- [ ] `node scripts/check-mr-contract.mjs`
- [ ] `node scripts/check-invariant-maturity.mjs`
- [ ] `node scripts/check-gate-result-hardening.mjs`
- [ ] `node scripts/check-rule-drift.mjs`
- [ ] Relevant backend tests:
- [ ] Relevant frontend tests:
- [ ] Relevant migration or runtime contract tests:

## No-Go

- P0 risks:
- P1 risks:
- P2 risks:
- [ ] No P0 blocker is hidden, skipped, renamed, or downgraded.
