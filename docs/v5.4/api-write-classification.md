# API Write Classification

## Scope

This document classifies the current non-GET reconciliation, correction-center,
and PC governance write endpoints in `services/core-api/WorkOS.Api/Program.cs`.

Classification modes:

- Mode A: Operations Confirm wrapper.
- Mode B: Governance provisional/control/import/candidate/audit write.
- Mode B2: Governance append-only correction service with explicit invariant evidence.
- Mode C: Disabled or feature-flag blocked.

`domain_events?` below means writes to `shadow_runtime.domain_events`. Some
routes write `audit_events` and `outbox_messages`; those are listed in
`writes tables` and are not classified as shadow runtime domain events.

## Routes

| route | classification | writes tables | writes domain_events? | writes ledger? | operations confirm? | invariant evidence | release status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /api/reconciliation/bank-statement-imports/preview` | Mode B, governance preview. No persisted write. | None. Parses request and returns preview only. | No | No | No | `bank.import_does_not_create_payment_fact`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/reconciliation/bank-statement-imports` | Mode B, bank import write. Imports source transactions only. | `bank_statement_imports`, `bank_transactions`, `evidence_objects.audit_trail` when an original file is provided. | No | No | No | `bank.import_does_not_create_payment_fact`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/reconciliation/match-candidates/generate` | Mode B, provisional candidate generation. | `payment_match_candidates`, `bank_transactions.status`. Reads payment/deposit/refund sources but does not mutate them. | No | No | No | `reconciliation.bank_transaction_single_match_default`; `bank.import_does_not_create_payment_fact`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/reconciliation/mismatches/detect` | Mode B, mismatch/case governance write. | `payment_mismatches`, `reconciliation_cases`, `audit_events`, `process_runs`, `process_work_item_intents`. | No | No | No | `bank.import_does_not_create_payment_fact`; `reconciliation.bank_transaction_single_match_default`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/reconciliation/match-candidates/{candidateId}/accept` | Mode B, manual governance match. | `audit_events`, `payment_matches`, `payment_match_candidates.status`, `bank_transactions.status`. Does not emit PaymentConfirmed or DepositConfirmed. | No | No | No | `reconciliation.bank_transaction_single_match_default`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/reconciliation/match-candidates/{candidateId}/reject` | Mode B, candidate decision. | `payment_match_candidates.status`. | No | No | No | `reconciliation.bank_transaction_single_match_default`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/reconciliation/bank-transactions/{bankTransactionId}/mismatch` | Mode B, manual mismatch/case governance write. | `payment_mismatches`, `bank_transactions.status`, `payment_match_candidates.status`, `reconciliation_cases`, `audit_events`, `process_runs`, `process_work_item_intents`. | No | No | No | `reconciliation.bank_transaction_single_match_default`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/reconciliation/bank-transactions/{bankTransactionId}/ignore` | Mode B, transaction decision. | `bank_transactions.status`, `payment_match_candidates.status`. | No | No | No | `reconciliation.bank_transaction_single_match_default`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/correction-center/ledger-correction-requests` | Mode B, correction request governance write. | `ledger_correction_requests`, `correction_cases`, `correction_audit`, `audit_events`, `outbox_messages`, `process_runs`, `process_work_item_intents`. | No | No | No | `correction.requires_reason`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/approve` | Mode B, correction approval governance write. | `correction_approvals`, `ledger_correction_requests.status`, `correction_cases.status`, `correction_audit`, `audit_events`, `outbox_messages`. | No | No | No | `correction.high_risk_requires_approval`; `correction.requires_reason`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/reject` | Mode B, correction rejection governance write. | `correction_approvals`, `ledger_correction_requests.status`, `correction_cases.status`, `correction_audit`, `audit_events`, `outbox_messages`. | No | No | No | `correction.requires_reason`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-09 `shadow` |
| `POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/apply` | Mode B2, explicit append-only correction service. Not a generic provisional write. | `ledger_correction_requests.status`, `correction_cases.status`, `payment_allocations` or `finance_reconciliations` or `deposit_transactions` or `hostel_charges`, `ledger_reversal_entries`, `ledger_correction_entries`, optional `period_late_adjustments`, `stay_balances`, `deposit_liabilities`, `correction_audit`, `audit_events`, `outbox_messages`. | No | Yes. Append-only correction effects plus projection rebuild; no in-place edit of the target ledger entry. | No | `ledger.no_edit_old_entry`; `correction.requires_reason`; `correction.high_risk_requires_approval`; `balance.rebuild_after_correction`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` `appendOnlyCorrectionService=true`. | MR-09 `shadow` |
| `POST /api/pc-governance/exports/{exportType}` | Mode B, governance export audit. Requires capability, reason, expiring URL, and trusted PC for high-risk exports. | `governance_export_audits`, `behavior_events`. | No | No | No | `pc.export_has_audit`; `api.no_page_specific_business_write`; v2 `governanceWriteAllowlist` guard. | MR-10 `shadow` |

## Decisions

- No listed route is Mode A today. These endpoints remain governance facades and
  are not the primary Operations Confirm business-write path.
- Bank import is Mode B and must not create `PaymentConfirmed`,
  `DepositConfirmed`, payment ledger facts, or deposit ledger facts.
- Reconciliation accept is Mode B: it records matching evidence, not a payment
  confirmation.
- Correction apply is Mode B2 because it can affect ledger/balance projections.
  It is allowed only as an explicit append-only correction service with the
  invariant evidence listed above.
- PC export is Mode B and must keep capability, reason, trusted-device, expiring
  URL, and persisted audit enforcement.
