# WON-14 Hostel Folio Ledger + Operating Analytics Runtime

WON-14 upgrades the hostel slice from a card workflow into a production
operating ledger runtime.

```text
Workspace-first Action Cards
-> Unified Action Runtime
-> AuditEvent Journal
-> Hostel Domain Ledgers
-> Finance Ledger
-> Outbox Projectors
-> Metrics Projection Store
-> PWA Acceptance Bench
```

The first production hostel loop is:

```text
LeadCaptured
-> BookingConfirmed
-> ResidentRegistered
-> BedAssigned
-> TariffAssigned
-> DepositRequired
-> PaymentRecordedByFrontDesk
-> PaymentConfirmedByFinance
-> StayCheckedIn
-> OperatingMetricsReviewed
```

This loop proves lead conversion, bed assignment, guest folio generation,
deposit liability posting, front-desk payment capture, finance reconciliation,
and operating metrics projection.

The slice owns these ledgers:

- `hostel_leads`
- `hostel_bookings`
- `hostel_stays`
- `guest_folios`
- `deposit_liabilities`
- `hostel_payments`
- `finance_reconciliations`
- `hostel_operating_metrics`

Deposits are not revenue. Payments are recorded by operations, but they become
trusted only after finance confirmation. Operating analytics are part of the
production runtime and must be validated by contract tests.
