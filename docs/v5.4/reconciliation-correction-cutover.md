# Reconciliation + Correction Cutover

MR-09 introduces the guarded runtime path for bank reconciliation and the
Correction Center. The first cutover state is shadow-only and keeps existing
finance facts as the source of truth while the new paths produce comparable
shadow evidence.

## Feature Flags

- `reconciliation.bank_import.enabled`
- `reconciliation.match_candidate.enabled`
- `reconciliation.manual_match.enabled`
- `reconciliation.mismatch_case.enabled`
- `correction.request.enabled`
- `correction.approve.enabled`
- `correction.apply.enabled`
- `correction.before_after_view.enabled`

All flags are scoped by tenant, slice, finance role, actor, device, device
trust, amount, and percentage. The pilot amount threshold starts at `<= 1000
KGS`.

## SliceCutoverState

- `Reconciliation`
- `CorrectionCenter`

Both slices start in `shadow` for `test-tenant`. Required dependencies are:

- `PaymentLedger = active_stable`
- `DepositLedger = active_stable`
- `StayBalanceProjection = active`
- `EvidenceSecureSubstrate = active`
- `PCFinanceLite = active`
- `GateResultRunner = active`
- `InvariantRunner = active`

## Routing

- Shadow: import, candidate generation, manual match, mismatch case, correction
  request, correction approval, correction apply, and before/after view produce
  shadow evidence only.
- Pilot: finance role only, actor scope configurable, trusted devices only,
  correction amount `<= 1000 KGS`, manual match only, automation disabled.
- Active: manual import, candidate generation, manual match, mismatch case, and
  correction are active. Full automatic matching remains disabled.
- Rollback: route `Reconciliation` to legacy/off and disable
  `correction.apply.enabled`. Already appended corrections are never deleted;
  use a compensating correction if an applied correction is wrong.

## Shadow Grade Contract

Green:

- import counts match expected
- no `PaymentConfirmed` created by import
- correction applies append-only

Yellow:

- display-only mismatch
- candidate score mismatch only

Red:

- bank import created business fact
- correction edited old entry
- high-risk correction without approval
- correction caused balance rebuild mismatch
- shadow consumed by official projector

## Invariants

- `bank.import_does_not_create_payment_fact`
- `reconciliation.bank_transaction_single_match_default`
- `ledger.no_edit_old_entry`
- `correction.requires_reason`
- `correction.high_risk_requires_approval`
- `balance.rebuild_after_correction`
