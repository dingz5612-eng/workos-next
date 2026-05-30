# Bank Reconciliation Mismatch Cases

V5.4 reconciliation mismatch handling treats bank statement issues as finance-owned cases, not as payment confirmation or ledger mutation.

## Detection

The detector creates `PaymentMismatchDetected` audit events, `payment_mismatches`, `reconciliation_cases`, and a finance-owned reconciliation WorkItem intent for:

- bank transactions with no open Payment / Deposit / Refund candidate
- confirmed payments without a bank match after the configured threshold
- amount mismatch
- currency mismatch
- duplicate bank transaction
- evidence amount mismatch
- refund paid without a matching bank debit after the configured threshold

## Case Contract

Each `ReconciliationCase` stores:

- mismatch type
- related bank transaction when present
- related payment / deposit / refund reference when present
- `ownerRole = finance`
- `dueAtUtc`
- blocker severity
- resolve actions

Supported resolve actions are:

- `acceptManualMatch`
- `markBankTransactionIgnored`
- `requestPaymentCorrection`
- `requestEvidenceCorrection`
- `createCorrectionRequest`
- `closeAsExplained`

## Guardrail

Mismatch detection and manual resolution do not create `PaymentConfirmed`, do not change confirmed payment amount, do not change deposit held amount, and do not update `StayBalance`.
