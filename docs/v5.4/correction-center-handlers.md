# Correction Center Handlers

V5.4 MR-09 adds the minimum ledger correction flow for manual reconciliation and finance correction work. The runtime entry points live in `services/core-api/WorkOS.Api/Runtime/CorrectionCenterService.cs` and persist through `services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs`.

## Command Handlers

- `LedgerCorrectionRequestCommandHandler`
  - Requires a source `workItemId`.
  - Inserts `ledger_correction_requests`.
  - Emits `LedgerCorrectionRequested`.
  - Records `correction_audit`.
  - Creates a process WorkItem intent:
    - high / critical risk -> `ledgerCorrectionApproval`
    - low / medium risk -> `ledgerCorrectionApply`

- `LedgerCorrectionApproveCommandHandler`
  - Inserts or updates `correction_approvals`.
  - Emits `LedgerCorrectionApproved`.
  - Moves the correction request to `approved`.

- `LedgerCorrectionRejectCommandHandler`
  - Inserts or updates `correction_approvals` with `rejected`.
  - Emits `LedgerCorrectionRejected`.
  - Moves the correction case to closed.

- `LedgerCorrectionApplyCommandHandler`
  - Blocks high / critical risk requests unless an approval exists.
  - Loads the target ledger entry with `for update`.
  - Appends reversal or correction entries only.
  - Emits:
    - `LedgerEntryReversed`
    - one domain-specific event: `PaymentAllocationReversed`, `PaymentAdjustmentLite`, `DepositEntryReversed`, or `ChargeAdjusted`
    - `LedgerCorrectionApplied`
  - Writes `ledger_reversal_entries`, `ledger_correction_entries`, and `correction_audit`.

## Append-Only Rules

Correction Center must not update or delete original ledger facts. Existing migration guards block direct fact edits for payment, allocation, deposit transaction, and charge ledgers. Apply appends a new row:

- Payment allocation correction appends a negative `payment_allocations` reversal row.
- Payment amount correction appends a `finance_reconciliations` correction row and emits `PaymentAdjustmentLite`; it is the formal path for payment amount corrections.
- Deposit correction appends a negative `deposit_transactions` row with the same transaction type.
- Charge correction appends a `hostel_charges` correction adjustment row.

## Rebuilds

After apply:

- Payment corrections rebuild `stay_balances`.
- Deposit corrections rebuild `deposit_liabilities`.
- Charge corrections rebuild `stay_balances`.

`availablePaymentAmount` is recalculated from confirmed reconciliation entries minus allocation entries. `heldAmount` and `availableRefund` are recalculated from deposit entries, including refund-related reversal entries. Lens reads remain projection-driven; the runtime does not accept corrected balances from a client payload.

If the corrected ledger entry falls inside a closed period, the flow records `period_late_adjustments`. It does not mutate the frozen period snapshot; MR-10 owns LateAdjustment governance.

## Verification

Runtime contract coverage is in `tests/WorkOS.RuntimeContractTests/Program.cs`:

- `correction_request_creates_work_item`
- `correction_approval_required_for_high_risk`
- `correction_apply_appends_reversal`
- `original_ledger_entry_not_modified`
- `payment_correction_rebuilds_stay_balance`
- `deposit_correction_rebuilds_deposit_balance`
- `charge_adjustment_rebuilds_stay_balance`
- `payment_allocation_reversal_from_correction_center`
- `deposit_entry_reversal_from_correction_center`
- `charge_adjustment_from_correction_center`
- `stay_balance_rebuild_after_correction`
- `deposit_balance_rebuild_after_correction`
- `correction_does_not_delete_original_event`
