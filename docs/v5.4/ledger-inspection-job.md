# V5.4 Ledger Inspection Job

The ledger inspection job is a machine-run reconciliation guard for Money,
Deposit, StayBalance, PeriodFinanceSnapshot, and Correction Center consistency.
It is intentionally read-only for business facts.

## Entry Points

- Daily CI schedule: `.github/workflows/v5_4_control_plane.yml`
- Manual CI run: `workflow_dispatch` in the same workflow
- Release gate run: `node scripts/v5_4/ledger-inspection.mjs --job-mode=release_gate`
- Local manual run:

```bash
node scripts/v5_4/ledger-inspection.mjs --job-mode=manual --releaseId=v5.4-ledger-inspection
```

## Checks

The job writes one `control_plane.runtime_invariant_checks` row per check:

- `ledger.payment_allocation_lte_confirmed_available`
- `ledger.deposit_held_amount_non_negative`
- `ledger.deposit_refund_lte_available_refund`
- `ledger.refund_failed_not_double_counted`
- `ledger.stay_balance_projection_matches_rebuild`
- `ledger.deposit_balance_projection_matches_rebuild`
- `period.finance_snapshot_source_consistency`
- `correction.applied_balance_consistency`

P0 failures block release gates. The PeriodFinanceSnapshot consistency check is
P1 because it is a snapshot-source integrity issue unless a downstream business
fact is also wrong.

## Outputs

The runner emits three files:

- `.tmp/v5_4/ledger-inspection-invariant-checks.json`
- `.tmp/v5_4/ledger-inspection-report.json`
- `.tmp/v5_4/ledger-inspection-dashboard-summary.json`

It also persists the report in
`control_plane.ledger_inspection_job_reports`. The `dashboard_summary` JSON is
the PC dashboard read model source for the latest ledger inspection status.

## Report Rules

- The job never creates or edits DomainEvent, LedgerEntry, Payment, Deposit,
  StayBalance, or Period snapshots.
- The job is allowed to write Control Plane evidence only:
  `runtime_invariant_checks` and `ledger_inspection_job_reports`.
- Release gate mode fails when any blocking invariant fails.
- Daily and manual modes produce the same evidence shape as release gate mode,
  so PC dashboards can compare scheduled health against release evidence.

## Remediation Mapping

- Payment allocation failure: open a Payment correction request.
- Deposit held/refund failure: open a Deposit or Refund correction request.
- StayBalance rebuild mismatch: run projection rebuild for `StayBalanceLens`.
- DepositBalance rebuild mismatch: run projection rebuild for
  `DepositBalanceLens`.
- Period snapshot source mismatch: regenerate the Period finance snapshot before
  period close, or append a LateAdjustment after close.
- Applied correction mismatch: open Correction Center audit and verify the
  appended reversal/correction entries.
