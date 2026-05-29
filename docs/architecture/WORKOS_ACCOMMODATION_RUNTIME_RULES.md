# WorkOS Accommodation Runtime Rules

This file owns accommodation-specific runtime boundaries. General runtime,
frontend, contract, and testing rules live in their own rule files and are
indexed from `WORKOS_ENGINEERING_RULES.md`.

## Fact Ownership Matrix

| Slice | Owns | Must Not Own |
| --- | --- | --- |
| `Accommodation.ResourceSetup` | Room, Bed, BedStatus, RatePlan | Lead, Stay, payment, deposit, expense, period snapshot facts |
| `Accommodation.LeadReservation` | Lead, Reservation | Stay lifecycle, bed status, payment, deposit, expense facts |
| `Accommodation.StayLifecycle` | Resident, Stay, Charge | Deposit transactions, payment allocations, expense facts |
| `Accommodation.DepositLedger` | Deposit, DepositTransaction, heldAmount | Revenue, expense, checkout flow ownership |
| `Accommodation.PaymentLedger` | Payment, PaymentAllocation, StayBalance | Deposit transactions, expense facts |
| `Accommodation.CheckOutSettlement` | Checkout flow only | Deposit transactions, payment allocations, BedStatus mutation |
| `Accommodation.ServiceTask` | Service task flow only | BedStatus mutation, room/bed release without verification, cost facts |
| `Accommodation.ExpenseLedger` | Approved expense and cost facts | Deposit refunds, payment allocations, bed status |
| `Accommodation.PeriodAnalytics` | Frozen period snapshots only | Mutable ledger facts, silent historical rewrite |

## Boundary Rules

- `CheckOutSettlement` does not own deposit transactions. It can request a
  settlement with `DepositSettlementRequested` or propose a checkout settlement,
  but `DepositRefundPaid`, `DepositDeducted`, and `DepositAppliedToBalance`
  remain under `DepositLedger`.
- `ServiceTask` does not directly change `BedStatus`. A service task can block
  availability at creation when the contract explicitly says so, and release
  can only be requested after `ServiceTaskVerified`.
- `ExpenseLedger` is the only cost fact source. Other slices may submit approved
  basis or references, but cost persistence and Lens cost facts come from
  `ExpenseLedger`.
- `PeriodAnalytics` closed snapshots are frozen. Late adjustments append a new
  event and derived view instead of mutating historical closed snapshots.
- Legacy `Accommodation.CheckIn` and the newer ledger slices may run in
  parallel only when they do not double-count deposit, payment, balance, or
  expense facts.
- Legacy `Accommodation.CheckIn` owns intake compatibility only:
  Lead/Booking/Resident/Stay/OperatingMetrics. It must not write
  `deposit_liabilities`, `accommodation_deposits`, `hostel_payments`,
  `finance_reconciliations`, `finance_confirmations`, `deposit_transactions`,
  `payment_allocations`, or `stay_balances`.
- Deposit receipts are liability facts, not revenue. Deposit refund payments are
  liability releases, not expense.
- Ledger policies must read backend ledger state. Request payloads express the
  current intent only, never trusted balances.

## Required Accommodation Guards

- `DepositLedger` confirms non-cash receipts only when real scoped evidence
  objects exist.
- `DepositLedger` settlement intents cannot exceed backend-computed held amount.
- `PaymentLedger` confirms non-cash ordinary payments only when real scoped
  evidence objects exist.
- `PaymentLedger` allocation cannot exceed backend-computed remaining
  allocatable amount.
- `CheckOutSettlement` cannot write `deposit_transactions`.
- `ServiceTask` cannot write room or bed availability facts directly.
- `ExpenseLedger` owns cost persistence and cost-facing Lens facts.
- `PeriodAnalytics` stores immutable close snapshots and append-only late
  adjustments.
- `PeriodAnalytics` finance snapshots query `DepositLedger`, `PaymentLedger`,
  `StayBalance`, and `ExpenseLedger`; confirm payload totals are review intent,
  not authoritative finance facts.
