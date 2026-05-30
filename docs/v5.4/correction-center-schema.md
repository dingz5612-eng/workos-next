# Correction Center Schema

Migration: `infra/db/migrations/020_correction_center_schema.sql`

## Scope

MR-09 adds the Correction Center foundation only. It stores manual correction
requests, approvals, append-only reversal entries, append-only correction
entries, audit records, and optional correction cases for finance ownership.

MR-09 does not implement automatic smart correction. Every correction starts
from an explicit request and is applied by append-only reversal/correction
records.

## Tables

- `ledger_correction_requests`: requested correction target, type, reason,
  requester, status, risk level, and timestamps.
- `correction_approvals`: finance/manager approval result for high-risk
  correction requests.
- `ledger_reversal_entries`: append-only reversal record that references the
  original ledger entry through `target_ledger_type` and `target_entry_id`.
- `ledger_correction_entries`: append-only before/after correction record with
  displayable JSON snapshots.
- `correction_audit`: actor/action/payload timeline for every correction
  request.
- `correction_cases`: optional operational case wrapper for assigning,
  tracking, and closing correction work.

## Guard Rules

- Existing ledger entries are not edited to fix money history.
- Corrections append `ledger_reversal_entries` or `ledger_correction_entries`.
- Reversals must reference the original `target_entry_id`.
- High-risk and critical corrections require an approved
  `correction_approvals` row before a reversal or correction entry can be
  inserted.
- `before_snapshot` and `after_snapshot` are required JSON objects so finance
  and audit views can explain the change.
- Correction append tables have update-blocking triggers. Later MR-09 handler
  work should route existing payment/deposit/charge/cash/refund mistakes
  through this schema instead of direct SQL updates.
- Existing ledger fact tables are guarded:
  `hostel_payments`, `finance_reconciliations`, `hostel_charges`,
  `deposit_transactions`, and `payment_allocations`. Field-level guards allow
  idempotent repeats and status/projection metadata where the current runtime
  requires it, but block direct changes to amount, currency, purpose,
  allocation, period, target reference, evidence/reference, and created event
  facts. Those changes must be represented by Correction Center append records.

## Enums

`target_ledger_type` values:

- `payment`
- `deposit`
- `charge`
- `cash`
- `refund`

`correction_type` values:

- `reversal`
- `amount_adjustment`
- `classification_adjustment`
- `evidence_correction`
- `allocation_reversal`
- `refund_correction`
- `charge_adjustment`

`risk_level` values:

- `low`
- `medium`
- `high`
- `critical`

## Rollback Note

WorkOSNext migrations are up-only. To reverse before production, add a
compensating migration that archives correction cases, audit rows,
correction/reversal entries, approvals, and requests before dropping triggers,
functions, and tables.
